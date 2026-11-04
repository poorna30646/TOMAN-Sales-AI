package ai.toman.notification.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import ai.toman.notification.api.InternalNotificationRequest;
import ai.toman.notification.api.NotificationPageResponse;
import ai.toman.notification.api.NotificationResponse;
import ai.toman.notification.domain.NotificationType;
import ai.toman.notification.domain.OwnerNotification;
import ai.toman.notification.repository.OwnerNotificationRepository;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

@ExtendWith(MockitoExtension.class)
class NotificationServiceTest {

    @Mock
    private OwnerNotificationRepository repository;

    @InjectMocks
    private NotificationService notifications;

    @Captor
    private ArgumentCaptor<OwnerNotification> notificationCaptor;

    @Test
    void createsARealPersistentInAppNotificationWithoutAnyFallbackData() {
        UUID workspaceId = UUID.randomUUID();
        UUID ownerId = UUID.randomUUID();
        UUID taskId = UUID.randomUUID();
        InternalNotificationRequest request = new InternalNotificationRequest(
                workspaceId,
                ownerId,
                NotificationType.REVIEW_REQUIRED,
                "Review campaign draft",
                "Jarvis needs your review before posting.",
                "agent_task",
                taskId);
        when(repository.save(any(OwnerNotification.class))).thenAnswer(invocation -> invocation.getArgument(0));

        NotificationResponse result = notifications.create(request);

        verify(repository).save(notificationCaptor.capture());
        OwnerNotification saved = notificationCaptor.getValue();
        assertThat(saved.getWorkspaceId()).isEqualTo(workspaceId);
        assertThat(saved.getOwnerId()).isEqualTo(ownerId);
        assertThat(saved.getType()).isEqualTo(NotificationType.REVIEW_REQUIRED);
        assertThat(result.id()).isEqualTo(saved.getId());
        assertThat(result.read()).isFalse();
    }

    @Test
    void notificationOutsideTheTrustedOwnerWorkspaceLooksNotFound() {
        UUID notificationId = UUID.randomUUID();
        when(repository.findByIdAndWorkspaceIdAndOwnerId(any(), any(), any())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> notifications.markRead(notificationId, UUID.randomUUID(), UUID.randomUUID()))
                .isInstanceOf(NotificationNotFoundException.class);
    }

    @Test
    void supportsUnreadOnlyPaginationAndKeepsTheUnreadBadgeScoped() {
        UUID workspaceId = UUID.randomUUID();
        UUID ownerId = UUID.randomUUID();
        OwnerNotification notification = OwnerNotification.create(
                workspaceId,
                ownerId,
                NotificationType.NEW_LEAD,
                "New lead",
                "A lead was captured.",
                null,
                null);
        when(repository.findAllByWorkspaceIdAndOwnerIdAndReadAtIsNull(any(), any(), any(Pageable.class)))
                .thenReturn(new PageImpl<>(java.util.List.of(notification)));
        when(repository.countByWorkspaceIdAndOwnerIdAndReadAtIsNull(workspaceId, ownerId)).thenReturn(1L);

        NotificationPageResponse result = notifications.list(workspaceId, ownerId, 0, 25, true);

        assertThat(result.content()).hasSize(1);
        assertThat(result.unreadCount()).isEqualTo(1);
        verify(repository).findAllByWorkspaceIdAndOwnerIdAndReadAtIsNull(any(), any(), any(Pageable.class));
    }

    @Test
    void rejectsAReferenceThatCouldNotBeSafelyLinked() {
        InternalNotificationRequest request = new InternalNotificationRequest(
                UUID.randomUUID(),
                UUID.randomUUID(),
                NotificationType.TASK_COMPLETED,
                "Task completed",
                "Your task has completed.",
                "agent_task",
                null);

        assertThatThrownBy(() -> notifications.create(request))
                .isInstanceOf(InvalidNotificationRequestException.class)
                .hasMessageContaining("referenceType");
    }
}
