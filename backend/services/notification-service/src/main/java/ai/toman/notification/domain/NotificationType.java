package ai.toman.notification.domain;

/** Events that must be visible to an owner in the in-app notification center. */
public enum NotificationType {
    REVIEW_REQUIRED,
    PERMISSION_REQUIRED,
    TASK_COMPLETED,
    NEW_LEAD
}
