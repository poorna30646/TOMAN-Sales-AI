package ai.toman.jarvis.service;

import ai.toman.jarvis.api.AgentTaskResponse;
import ai.toman.jarvis.api.CreateAgentTaskRequest;
import ai.toman.jarvis.api.OwnerDecisionRequest;
import ai.toman.jarvis.domain.AgentTask;
import ai.toman.jarvis.domain.AgentTaskRepository;
import ai.toman.jarvis.meta.MetaModelCallException;
import ai.toman.jarvis.meta.MetaModelClient;
import ai.toman.jarvis.notification.ReviewNotificationOutbox;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class JarvisTaskService {

    private final AgentTaskRepository tasks;
    private final MetaModelClient metaModel;
    private final ReviewNotificationOutbox reviewNotifications;
    private final JsonMapper objectMapper;

    public JarvisTaskService(
            AgentTaskRepository tasks,
            MetaModelClient metaModel,
            ReviewNotificationOutbox reviewNotifications,
            JsonMapper objectMapper) {
        this.tasks = tasks;
        this.metaModel = metaModel;
        this.reviewNotifications = reviewNotifications;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public AgentTaskResponse create(UUID workspaceId, UUID ownerId, CreateAgentTaskRequest request) {
        AgentTask task = tasks.save(AgentTask.start(
                workspaceId,
                ownerId,
                request.effectiveTitle(),
                request.prompt().trim()));

        if (!metaModel.isConfigured()) {
            task.blockConfiguration("Set META_AI_API_KEY on jarvis-service before asking Jarvis to generate a plan.");
            return response(tasks.save(task));
        }

        task.planning(metaModel.modelId());
        tasks.save(task);
        try {
            JsonNode plan = metaModel.createSalesPlan(task.getPrompt());
            task.awaitOwnerReview(objectMapper.writeValueAsString(plan));
            AgentTask awaitingReview = tasks.save(task);
            reviewNotifications.enqueue(awaitingReview);
            return response(awaitingReview);
        } catch (MetaModelCallException exception) {
            if ("META_MODEL_NOT_CONFIGURED".equals(exception.getCode())) {
                task.blockConfiguration(exception.getMessage());
            } else {
                task.fail(exception.getCode(), exception.getMessage());
            }
            return response(tasks.save(task));
        } catch (JacksonException exception) {
            task.fail("META_PLAN_SERIALIZATION_FAILED", "The Meta Model plan could not be safely stored.");
            return response(tasks.save(task));
        }
    }

    @Transactional(readOnly = true)
    public List<AgentTaskResponse> list(UUID workspaceId, UUID ownerId) {
        return tasks.findByWorkspaceIdAndOwnerIdOrderByCreatedAtDesc(workspaceId, ownerId)
                .stream()
                .map(this::response)
                .toList();
    }

    @Transactional
    public AgentTaskResponse ownerDecision(UUID id, UUID workspaceId, UUID ownerId, OwnerDecisionRequest decision) {
        AgentTask task = tasks.findByIdAndWorkspaceIdAndOwnerId(id, workspaceId, ownerId)
                .orElseThrow(() -> new NoSuchElementException("Jarvis task was not found in this workspace"));
        if (decision.approved()) {
            task.approve();
        } else {
            task.reject(decision.note() == null || decision.note().isBlank()
                    ? "Owner requested changes"
                    : decision.note().trim());
        }
        return response(tasks.save(task));
    }

    private AgentTaskResponse response(AgentTask task) {
        JsonNode plan = null;
        if (task.getPlanJson() != null && !task.getPlanJson().isBlank()) {
            try {
                plan = objectMapper.readTree(task.getPlanJson());
            } catch (JacksonException ignored) {
                // This cannot fabricate a substitute plan. The API communicates the real storage failure.
            }
        }
        return AgentTaskResponse.from(task, plan);
    }
}
