package ai.toman.workspace.api;

import ai.toman.workspace.domain.Workspace;
import java.time.Instant;
import java.util.UUID;

public record WorkspaceResponse(
        UUID id,
        String businessName,
        String industry,
        String businessDescription,
        String timezone,
        Instant createdAt,
        Instant updatedAt
) {
    public static WorkspaceResponse from(Workspace workspace) {
        return new WorkspaceResponse(
                workspace.getId(),
                workspace.getBusinessName(),
                workspace.getIndustry(),
                workspace.getBusinessDescription(),
                workspace.getTimezone(),
                workspace.getCreatedAt(),
                workspace.getUpdatedAt());
    }
}
