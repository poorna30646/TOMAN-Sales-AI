package ai.toman.jarvis.api;

import ai.toman.jarvis.domain.AgentTask;
import ai.toman.jarvis.domain.AgentTaskStatus;
import tools.jackson.databind.JsonNode;
import java.time.Instant;
import java.util.UUID;

public record AgentTaskResponse(
        UUID id,
        String title,
        String prompt,
        AgentTaskStatus status,
        String modelId,
        JsonNode plan,
        String failureCode,
        String failureDetail,
        Instant createdAt,
        Instant updatedAt) {

    public static AgentTaskResponse from(AgentTask task, JsonNode plan) {
        return new AgentTaskResponse(
                task.getId(),
                task.getTitle(),
                task.getPrompt(),
                task.getStatus(),
                task.getModelId(),
                plan,
                task.getFailureCode(),
                task.getFailureDetail(),
                task.getCreatedAt(),
                task.getUpdatedAt());
    }
}
