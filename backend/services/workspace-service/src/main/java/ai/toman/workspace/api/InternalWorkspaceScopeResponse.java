package ai.toman.workspace.api;

import java.util.UUID;

/** Internal gateway-only workspace binding; it is not exposed by the public route map. */
public record InternalWorkspaceScopeResponse(UUID workspaceId) {
}
