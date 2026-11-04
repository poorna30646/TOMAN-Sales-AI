package ai.toman.workspace.api;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateWorkspaceRequest(
        @NotBlank @Size(max = 160) String businessName,
        @Size(max = 100) String industry,
        @Size(max = 5000) String businessDescription,
        @NotBlank @Size(max = 80) String timezone
) {
}
