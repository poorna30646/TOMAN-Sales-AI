package ai.toman.workspace.domain;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WorkspaceSettingsRepository extends JpaRepository<WorkspaceSettings, UUID> {
}
