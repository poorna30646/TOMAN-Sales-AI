package ai.toman.jarvis.notification;

import ai.toman.jarvis.domain.AgentTask;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/**
 * A local outbox record makes an owner review alert durable even if the
 * notification service is briefly unavailable when Jarvis finishes planning.
 */
@Entity
@Table(name = "review_notification_outbox")
public class ReviewNotificationOutboxEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false, updatable = false, columnDefinition = "BINARY(16)")
    private UUID id;

    @Column(name = "task_id", nullable = false, updatable = false, unique = true, columnDefinition = "BINARY(16)")
    private UUID taskId;

    @Column(name = "workspace_id", nullable = false, updatable = false, columnDefinition = "BINARY(16)")
    private UUID workspaceId;

    @Column(name = "owner_id", nullable = false, updatable = false, columnDefinition = "BINARY(16)")
    private UUID ownerId;

    @Column(name = "title", nullable = false, length = 180)
    private String title;

    @Column(name = "message", nullable = false, length = 1500)
    private String message;

    @Column(name = "attempt_count", nullable = false)
    private int attemptCount;

    @Column(name = "last_attempt_at")
    private Instant lastAttemptAt;

    @Column(name = "last_error", length = 1000)
    private String lastError;

    @Column(name = "delivered_at")
    private Instant deliveredAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected ReviewNotificationOutboxEvent() {
    }

    private ReviewNotificationOutboxEvent(AgentTask task) {
        this.taskId = task.getId();
        this.workspaceId = task.getWorkspaceId();
        this.ownerId = task.getOwnerId();
        this.title = "Jarvis needs your review";
        this.message = "Jarvis prepared \"" + task.getTitle() + "\". Review the plan before any external action.";
    }

    public static ReviewNotificationOutboxEvent forTask(AgentTask task) {
        return new ReviewNotificationOutboxEvent(task);
    }

    public void delivered() {
        this.attemptCount++;
        this.lastAttemptAt = Instant.now();
        this.deliveredAt = this.lastAttemptAt;
        this.lastError = null;
    }

    public void failed(String message) {
        this.attemptCount++;
        this.lastAttemptAt = Instant.now();
        this.lastError = message == null ? "Notification delivery failed." : message.substring(0, Math.min(1000, message.length()));
    }

    @PrePersist
    void created() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }

    public UUID getId() { return id; }
    public UUID getTaskId() { return taskId; }
    public UUID getWorkspaceId() { return workspaceId; }
    public UUID getOwnerId() { return ownerId; }
    public String getTitle() { return title; }
    public String getMessage() { return message; }
    public int getAttemptCount() { return attemptCount; }
    public Instant getLastAttemptAt() { return lastAttemptAt; }
    public String getLastError() { return lastError; }
    public Instant getDeliveredAt() { return deliveredAt; }
}
