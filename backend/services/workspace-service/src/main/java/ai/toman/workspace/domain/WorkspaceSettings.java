package ai.toman.workspace.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.sql.Types;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;

@Entity
@Table(name = "workspace_settings")
public class WorkspaceSettings {

    @Id
    @Column(name = "workspace_id", nullable = false, columnDefinition = "BINARY(16)")
    @JdbcTypeCode(Types.BINARY)
    private UUID workspaceId;

    @Column(name = "review_notifications_enabled", nullable = false)
    private boolean reviewNotificationsEnabled = true;

    @Column(name = "permission_notifications_enabled", nullable = false)
    private boolean permissionNotificationsEnabled = true;

    @Column(name = "completed_task_notifications_enabled", nullable = false)
    private boolean completedTaskNotificationsEnabled = true;

    @Column(name = "new_lead_notifications_enabled", nullable = false)
    private boolean newLeadNotificationsEnabled = true;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected WorkspaceSettings() {
    }

    private WorkspaceSettings(UUID workspaceId) {
        this.workspaceId = workspaceId;
    }

    public static WorkspaceSettings defaultsFor(UUID workspaceId) {
        return new WorkspaceSettings(workspaceId);
    }

    public void update(boolean review, boolean permission, boolean completed, boolean newLead) {
        this.reviewNotificationsEnabled = review;
        this.permissionNotificationsEnabled = permission;
        this.completedTaskNotificationsEnabled = completed;
        this.newLeadNotificationsEnabled = newLead;
        this.updatedAt = Instant.now();
    }

    @jakarta.persistence.PrePersist
    void initializeTimestamp() {
        if (updatedAt == null) {
            updatedAt = Instant.now();
        }
    }

    public UUID getWorkspaceId() { return workspaceId; }
    public boolean isReviewNotificationsEnabled() { return reviewNotificationsEnabled; }
    public boolean isPermissionNotificationsEnabled() { return permissionNotificationsEnabled; }
    public boolean isCompletedTaskNotificationsEnabled() { return completedTaskNotificationsEnabled; }
    public boolean isNewLeadNotificationsEnabled() { return newLeadNotificationsEnabled; }
    public Instant getUpdatedAt() { return updatedAt; }
}
