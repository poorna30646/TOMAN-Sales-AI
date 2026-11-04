package ai.toman.workspace.service;

import ai.toman.workspace.api.CreateWorkspaceRequest;
import ai.toman.workspace.api.SettingsResponse;
import ai.toman.workspace.api.UpdateSettingsRequest;
import ai.toman.workspace.api.WorkspaceResponse;
import ai.toman.workspace.domain.Workspace;
import ai.toman.workspace.domain.WorkspaceRepository;
import ai.toman.workspace.domain.WorkspaceSettings;
import ai.toman.workspace.domain.WorkspaceSettingsRepository;
import java.time.ZoneId;
import java.time.zone.ZoneRulesException;
import java.util.UUID;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class WorkspaceApplicationService {

    private final WorkspaceRepository workspaces;
    private final WorkspaceSettingsRepository settings;

    public WorkspaceApplicationService(WorkspaceRepository workspaces, WorkspaceSettingsRepository settings) {
        this.workspaces = workspaces;
        this.settings = settings;
    }

    @Transactional
    public WorkspaceResponse create(UUID ownerId, CreateWorkspaceRequest request) {
        if (workspaces.findByOwnerId(ownerId).isPresent()) {
            throw WorkspaceDomainException.conflict(
                    "WORKSPACE_ALREADY_EXISTS",
                    "This owner already has a TOMAN workspace.");
        }
        Workspace workspace = Workspace.create(
                ownerId,
                requiredText(request.businessName()),
                optionalText(request.industry()),
                optionalText(request.businessDescription()),
                validTimezone(request.timezone()));
        try {
            Workspace saved = workspaces.save(workspace);
            settings.save(WorkspaceSettings.defaultsFor(saved.getId()));
            return WorkspaceResponse.from(saved);
        } catch (DataIntegrityViolationException exception) {
            throw WorkspaceDomainException.conflict(
                    "WORKSPACE_ALREADY_EXISTS",
                    "This owner already has a TOMAN workspace.");
        }
    }

    @Transactional(readOnly = true)
    public WorkspaceResponse current(UUID ownerId) {
        return WorkspaceResponse.from(workspaceFor(ownerId));
    }

    @Transactional(readOnly = true)
    public SettingsResponse settings(UUID ownerId) {
        Workspace workspace = workspaceFor(ownerId);
        WorkspaceSettings preferences = settings.findById(workspace.getId())
                .orElseThrow(() -> WorkspaceDomainException.notFound(
                        "SETTINGS_NOT_FOUND", "Workspace settings were not found."));
        return SettingsResponse.from(workspace, preferences);
    }

    @Transactional
    public SettingsResponse updateSettings(UUID ownerId, UpdateSettingsRequest request) {
        Workspace workspace = workspaceFor(ownerId);
        workspace.updateProfile(
                requiredText(request.businessName()),
                optionalText(request.industry()),
                optionalText(request.businessDescription()),
                validTimezone(request.timezone()));
        WorkspaceSettings preferences = settings.findById(workspace.getId())
                .orElseThrow(() -> WorkspaceDomainException.notFound(
                        "SETTINGS_NOT_FOUND", "Workspace settings were not found."));
        preferences.update(
                request.reviewNotificationsEnabled(),
                request.permissionNotificationsEnabled(),
                request.completedTaskNotificationsEnabled(),
                request.newLeadNotificationsEnabled());
        return SettingsResponse.from(workspaces.save(workspace), settings.save(preferences));
    }

    private Workspace workspaceFor(UUID ownerId) {
        return workspaces.findByOwnerId(ownerId)
                .orElseThrow(() -> WorkspaceDomainException.notFound(
                        "WORKSPACE_NOT_FOUND",
                        "Finish business setup before using this part of TOMAN."));
    }

    private String validTimezone(String timezone) {
        String value = requiredText(timezone);
        try {
            return ZoneId.of(value).getId();
        } catch (ZoneRulesException exception) {
            throw WorkspaceDomainException.badRequest("INVALID_TIMEZONE", "Choose a valid IANA timezone.");
        }
    }

    private String requiredText(String value) {
        String normalized = optionalText(value);
        if (normalized == null) {
            throw WorkspaceDomainException.badRequest("REQUIRED_VALUE_MISSING", "A required value is missing.");
        }
        return normalized;
    }

    private String optionalText(String value) {
        if (value == null) {
            return null;
        }
        String normalized = value.trim().replaceAll("\\s+", " ");
        return normalized.isEmpty() ? null : normalized;
    }
}
