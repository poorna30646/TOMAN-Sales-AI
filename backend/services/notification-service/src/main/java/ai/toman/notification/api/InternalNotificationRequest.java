package ai.toman.notification.api;

import ai.toman.notification.domain.NotificationType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.UUID;

/**
 * Contract used only by trusted TOMAN services. Public clients cannot select
 * an owner or workspace—the gateway supplies that identity on public routes.
 */
public record InternalNotificationRequest(
        @NotNull UUID workspaceId,
        @NotNull UUID ownerId,
        @NotNull NotificationType type,
        @NotBlank @Size(max = 180) String title,
        @NotBlank @Size(max = 1500) String message,
        @Size(max = 80) String referenceType,
        UUID referenceId) {
}
