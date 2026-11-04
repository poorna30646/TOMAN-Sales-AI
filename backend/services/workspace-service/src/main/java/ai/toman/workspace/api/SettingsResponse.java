package ai.toman.workspace.api;

import ai.toman.workspace.domain.Workspace;
import ai.toman.workspace.domain.WorkspaceSettings;
import java.time.Instant;
import java.util.UUID;

public record SettingsResponse(
        UUID workspaceId,
        String businessName,
        String industry,
        String businessDescription,
        String timezone,
        boolean reviewNotificationsEnabled,
        boolean permissionNotificationsEnabled,
        boolean completedTaskNotificationsEnabled,
        boolean newLeadNotificationsEnabled,
        Instant updatedAt
) {
    public static SettingsResponse from(Workspace workspace, WorkspaceSettings settings) {
        return new SettingsResponse(
                workspace.getId(),
                workspace.getBusinessName(),
                workspace.getIndustry(),
                workspace.getBusinessDescription(),
                workspace.getTimezone(),
                settings.isReviewNotificationsEnabled(),
                settings.isPermissionNotificationsEnabled(),
                settings.isCompletedTaskNotificationsEnabled(),
                settings.isNewLeadNotificationsEnabled(),
                settings.getUpdatedAt());
    }
}
