package ai.toman.workspace.api;

import ai.toman.workspace.service.WorkspaceApplicationService;
import java.util.UUID;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class WorkspaceController {

    private static final String OWNER_HEADER = "X-TOMAN-User-Id";
    private final WorkspaceApplicationService workspaces;

    public WorkspaceController(WorkspaceApplicationService workspaces) {
        this.workspaces = workspaces;
    }

    @PostMapping("/api/v1/workspaces")
    @ResponseStatus(HttpStatus.CREATED)
    public WorkspaceResponse create(
            @RequestHeader(OWNER_HEADER) UUID ownerId,
            @Valid @RequestBody CreateWorkspaceRequest request
    ) {
        return workspaces.create(ownerId, request);
    }

    @GetMapping("/api/v1/workspaces/current")
    public WorkspaceResponse current(@RequestHeader(OWNER_HEADER) UUID ownerId) {
        return workspaces.current(ownerId);
    }

    @GetMapping("/internal/v1/workspaces/current")
    public InternalWorkspaceScopeResponse currentForGateway(@RequestHeader(OWNER_HEADER) UUID ownerId) {
        return new InternalWorkspaceScopeResponse(workspaces.current(ownerId).id());
    }

    @GetMapping("/api/v1/settings")
    public SettingsResponse settings(@RequestHeader(OWNER_HEADER) UUID ownerId) {
        return workspaces.settings(ownerId);
    }

    @PutMapping("/api/v1/settings")
    public SettingsResponse updateSettings(
            @RequestHeader(OWNER_HEADER) UUID ownerId,
            @Valid @RequestBody UpdateSettingsRequest request
    ) {
        return workspaces.updateSettings(ownerId, request);
    }
}
