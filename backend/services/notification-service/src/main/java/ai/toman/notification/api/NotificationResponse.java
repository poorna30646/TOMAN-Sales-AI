package ai.toman.notification.api;

import ai.toman.notification.domain.NotificationType;
import ai.toman.notification.domain.OwnerNotification;
import java.time.Instant;
import java.util.UUID;

public record NotificationResponse(
        UUID id,
        NotificationType type,
        String title,
        String message,
        String referenceType,
        UUID referenceId,
        boolean read,
        Instant readAt,
        Instant createdAt) {

    public static NotificationResponse from(OwnerNotification notification) {
        return new NotificationResponse(
                notification.getId(),
                notification.getType(),
                notification.getTitle(),
                notification.getMessage(),
                notification.getReferenceType(),
                notification.getReferenceId(),
                notification.getReadAt() != null,
                notification.getReadAt(),
                notification.getCreatedAt());
    }
}
