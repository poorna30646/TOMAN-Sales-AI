package ai.toman.ingestion.service;

import java.util.UUID;

/** A gateway-authenticated owner/workspace scope. */
public record DocumentScope(UUID ownerId, UUID workspaceId) {
}
