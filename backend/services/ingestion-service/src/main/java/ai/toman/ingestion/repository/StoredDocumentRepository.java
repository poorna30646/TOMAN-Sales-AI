package ai.toman.ingestion.repository;

import ai.toman.ingestion.domain.StoredDocument;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface StoredDocumentRepository extends JpaRepository<StoredDocument, UUID> {

    List<StoredDocument> findByWorkspaceIdAndOwnerIdOrderByCreatedAtDesc(UUID workspaceId, UUID ownerId);

    Optional<StoredDocument> findByIdAndWorkspaceIdAndOwnerId(UUID id, UUID workspaceId, UUID ownerId);
}
