package ai.toman.jarvis.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "agent_tasks")
public class AgentTask {

    @Id
    @Column(columnDefinition = "BINARY(16)", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "workspace_id", columnDefinition = "BINARY(16)", nullable = false, updatable = false)
    private UUID workspaceId;

    @Column(name = "owner_id", columnDefinition = "BINARY(16)", nullable = false, updatable = false)
    private UUID ownerId;

    @Column(nullable = false, length = 180)
    private String title;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String prompt;

    @Enumerated(EnumType.STRING)
    @Column(name = "task_status", nullable = false, length = 48)
    private AgentTaskStatus status;

    @Column(name = "model_id", length = 100)
    private String modelId;

    @Column(name = "plan_json", columnDefinition = "json")
    private String planJson;

    @Column(name = "failure_code", length = 100)
    private String failureCode;

    @Column(name = "failure_detail", length = 1000)
    private String failureDetail;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected AgentTask() {
    }

    public static AgentTask start(UUID workspaceId, UUID ownerId, String title, String prompt) {
        AgentTask task = new AgentTask();
        task.id = UUID.randomUUID();
        task.workspaceId = workspaceId;
        task.ownerId = ownerId;
        task.title = title;
        task.prompt = prompt;
        task.status = AgentTaskStatus.CREATED;
        return task;
    }

    public void planning(String modelId) {
        this.status = AgentTaskStatus.PLANNING;
        this.modelId = modelId;
        this.failureCode = null;
        this.failureDetail = null;
    }

    public void awaitOwnerReview(String planJson) {
        this.status = AgentTaskStatus.AWAITING_OWNER_REVIEW;
        this.planJson = planJson;
        this.failureCode = null;
        this.failureDetail = null;
    }

    public void blockConfiguration(String detail) {
        this.status = AgentTaskStatus.BLOCKED_CONFIGURATION;
        this.failureCode = "META_MODEL_NOT_CONFIGURED";
        this.failureDetail = detail;
    }

    public void fail(String code, String detail) {
        this.status = AgentTaskStatus.FAILED;
        this.failureCode = code;
        this.failureDetail = detail;
    }

    public void approve() {
        if (status != AgentTaskStatus.AWAITING_OWNER_REVIEW) {
            throw new IllegalStateException("Only a task awaiting owner review can be approved");
        }
        this.status = AgentTaskStatus.APPROVED;
    }

    public void reject(String note) {
        if (status != AgentTaskStatus.AWAITING_OWNER_REVIEW) {
            throw new IllegalStateException("Only a task awaiting owner review can be rejected");
        }
        this.status = AgentTaskStatus.REJECTED;
        this.failureDetail = note;
    }

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        this.createdAt = now;
        this.updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        this.updatedAt = Instant.now();
    }

    public UUID getId() { return id; }
    public UUID getWorkspaceId() { return workspaceId; }
    public UUID getOwnerId() { return ownerId; }
    public String getTitle() { return title; }
    public String getPrompt() { return prompt; }
    public AgentTaskStatus getStatus() { return status; }
    public String getModelId() { return modelId; }
    public String getPlanJson() { return planJson; }
    public String getFailureCode() { return failureCode; }
    public String getFailureDetail() { return failureDetail; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
