package ai.toman.jarvis.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import ai.toman.jarvis.api.AgentTaskResponse;
import ai.toman.jarvis.api.CreateAgentTaskRequest;
import ai.toman.jarvis.domain.AgentTask;
import ai.toman.jarvis.domain.AgentTaskRepository;
import ai.toman.jarvis.domain.AgentTaskStatus;
import ai.toman.jarvis.meta.MetaModelClient;
import ai.toman.jarvis.notification.ReviewNotificationOutbox;
import tools.jackson.databind.json.JsonMapper;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class JarvisTaskServiceTest {

    @Mock
    private AgentTaskRepository repository;

    @Mock
    private MetaModelClient metaModel;

    @Mock
    private ReviewNotificationOutbox reviewNotifications;

    private JarvisTaskService service;

    @BeforeEach
    void setUp() {
        service = new JarvisTaskService(repository, metaModel, reviewNotifications, JsonMapper.builder().build());
        when(repository.save(any(AgentTask.class))).thenAnswer(invocation -> invocation.getArgument(0));
    }

    @Test
    void neverFabricatesAPreparedPlanWhenMetaModelIsNotConfigured() {
        when(metaModel.isConfigured()).thenReturn(false);

        AgentTaskResponse response = service.create(
                UUID.randomUUID(),
                UUID.randomUUID(),
                new CreateAgentTaskRequest("Holiday follow-up", "Create a campaign for recent repeat buyers."));

        assertThat(response.status()).isEqualTo(AgentTaskStatus.BLOCKED_CONFIGURATION);
        assertThat(response.plan()).isNull();
        assertThat(response.failureCode()).isEqualTo("META_MODEL_NOT_CONFIGURED");
        verify(metaModel, never()).createSalesPlan(any());
        verify(reviewNotifications, never()).enqueue(any());
    }

    @Test
    void storesOnlyTheStructuredPlanReturnedByMetaModel() throws Exception {
        when(metaModel.isConfigured()).thenReturn(true);
        when(metaModel.modelId()).thenReturn("muse-spark-1.3");
        when(metaModel.createSalesPlan(any())).thenReturn(JsonMapper.builder().build().readTree("""
                {"title":"Consent-aware campaign","summary":"Review required","objective":"re-engagement",
                 "audienceRationale":"recent opt-in activity","ownerReviewRequired":true,
                 "recommendedAgents":["Growth Strategist"],
                 "proposedActions":[{"agent":"Creative Studio","action":"draft copy","requiresOwnerApproval":true}]}
                """));

        AgentTaskResponse response = service.create(
                UUID.randomUUID(),
                UUID.randomUUID(),
                new CreateAgentTaskRequest(null, "Prepare a re-engagement plan."));

        assertThat(response.status()).isEqualTo(AgentTaskStatus.AWAITING_OWNER_REVIEW);
        assertThat(response.modelId()).isEqualTo("muse-spark-1.3");
        assertThat(response.plan().path("title").asText()).isEqualTo("Consent-aware campaign");
        assertThat(response.plan().path("ownerReviewRequired").asBoolean()).isTrue();
        verify(reviewNotifications).enqueue(any(AgentTask.class));
    }
}
