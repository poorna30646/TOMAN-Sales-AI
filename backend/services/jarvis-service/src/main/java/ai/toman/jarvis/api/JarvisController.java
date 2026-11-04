package ai.toman.jarvis.api;

import ai.toman.jarvis.meta.MetaModelClient;
import ai.toman.jarvis.service.JarvisTaskService;
import ai.toman.jarvis.workspace.WorkspaceScopeResolver;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * The API gateway validates the Auth Service token and supplies the two
 * identity headers. This service deliberately does not accept a user ID or a
 * model key in its request body.
 */
@RestController
@RequestMapping("/api/v1/jarvis")
public class JarvisController {

    private final JarvisTaskService tasks;
    private final MetaModelClient metaModel;
    private final WorkspaceScopeResolver workspaceScope;

    public JarvisController(
            JarvisTaskService tasks,
            MetaModelClient metaModel,
            WorkspaceScopeResolver workspaceScope) {
        this.tasks = tasks;
        this.metaModel = metaModel;
        this.workspaceScope = workspaceScope;
    }

    @PostMapping("/tasks")
    @ResponseStatus(HttpStatus.CREATED)
    public AgentTaskResponse createTask(
            @RequestHeader("X-TOMAN-User-Id") UUID ownerId,
            @RequestHeader(value = "X-TOMAN-Workspace-Id", required = false) UUID workspaceId,
            @Valid @RequestBody CreateAgentTaskRequest request) {
        return tasks.create(workspaceScope.resolve(ownerId, workspaceId), ownerId, request);
    }

    @GetMapping("/tasks")
    public List<AgentTaskResponse> listTasks(
            @RequestHeader("X-TOMAN-User-Id") UUID ownerId,
            @RequestHeader(value = "X-TOMAN-Workspace-Id", required = false) UUID workspaceId) {
        return tasks.list(workspaceScope.resolve(ownerId, workspaceId), ownerId);
    }

    @PostMapping("/tasks/{taskId}/owner-decision")
    public AgentTaskResponse ownerDecision(
            @PathVariable UUID taskId,
            @RequestHeader("X-TOMAN-User-Id") UUID ownerId,
            @RequestHeader(value = "X-TOMAN-Workspace-Id", required = false) UUID workspaceId,
            @Valid @RequestBody OwnerDecisionRequest decision) {
        return tasks.ownerDecision(taskId, workspaceScope.resolve(ownerId, workspaceId), ownerId, decision);
    }

    @GetMapping("/meta/status")
    public MetaModelStatusResponse metaStatus() {
        return new MetaModelStatusResponse(metaModel.isConfigured(), "Meta Model API", metaModel.modelId());
    }
}
