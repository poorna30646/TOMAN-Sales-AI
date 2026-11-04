package ai.toman.jarvis.domain;

/**
 * No task may progress to a live external action from this service. Approval,
 * scheduling, publishing, messaging, calling, and ad spend are handled by
 * separate services after an owner decision has been recorded.
 */
public enum AgentTaskStatus {
    CREATED,
    PLANNING,
    AWAITING_OWNER_REVIEW,
    APPROVED,
    REJECTED,
    BLOCKED_CONFIGURATION,
    FAILED
}
