package ai.toman.jarvis.domain;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AgentTaskRepository extends JpaRepository<AgentTask, UUID> {
    List<AgentTask> findByWorkspaceIdAndOwnerIdOrderByCreatedAtDesc(UUID workspaceId, UUID ownerId);

    Optional<AgentTask> findByIdAndWorkspaceIdAndOwnerId(UUID id, UUID workspaceId, UUID ownerId);
}
