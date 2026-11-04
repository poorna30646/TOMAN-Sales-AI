package ai.toman.notification.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "owner_notifications")
public class OwnerNotification {

    @Id
    @Column(columnDefinition = "BINARY(16)", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "workspace_id", columnDefinition = "BINARY(16)", nullable = false, updatable = false)
    private UUID workspaceId;

    @Column(name = "owner_id", columnDefinition = "BINARY(16)", nullable = false, updatable = false)
    private UUID ownerId;

    @Enumerated(EnumType.STRING)
    @Column(name = "event_type", nullable = false, length = 48, updatable = false)
    private NotificationType type;

    @Column(nullable = false, length = 180, updatable = false)
    private String title;

    @Column(nullable = false, length = 1500, updatable = false)
    private String message;

    @Column(name = "reference_type", length = 80, updatable = false)
    private String referenceType;

    @Column(name = "reference_id", columnDefinition = "BINARY(16)", updatable = false)
    private UUID referenceId;

    @Column(name = "read_at")
    private Instant readAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected OwnerNotification() {
    }

    public static OwnerNotification create(
            UUID workspaceId,
            UUID ownerId,
            NotificationType type,
            String title,
            String message,
            String referenceType,
            UUID referenceId) {
        OwnerNotification notification = new OwnerNotification();
        notification.id = UUID.randomUUID();
        notification.workspaceId = workspaceId;
        notification.ownerId = ownerId;
        notification.type = type;
        notification.title = title;
        notification.message = message;
        notification.referenceType = referenceType;
        notification.referenceId = referenceId;
        return notification;
    }

    public void markRead(Instant readAt) {
        if (this.readAt == null) {
            this.readAt = readAt;
        }
    }

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }

    public UUID getId() { return id; }
    public UUID getWorkspaceId() { return workspaceId; }
    public UUID getOwnerId() { return ownerId; }
    public NotificationType getType() { return type; }
    public String getTitle() { return title; }
    public String getMessage() { return message; }
    public String getReferenceType() { return referenceType; }
    public UUID getReferenceId() { return referenceId; }
    public Instant getReadAt() { return readAt; }
    public Instant getCreatedAt() { return createdAt; }
}
