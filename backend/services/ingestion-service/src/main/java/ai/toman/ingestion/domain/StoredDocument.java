package ai.toman.ingestion.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "documents")
public class StoredDocument {

    @Id
    @Column(columnDefinition = "BINARY(16)", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "workspace_id", columnDefinition = "BINARY(16)", nullable = false, updatable = false)
    private UUID workspaceId;

    @Column(name = "owner_id", columnDefinition = "BINARY(16)", nullable = false, updatable = false)
    private UUID ownerId;

    @Column(name = "original_filename", nullable = false, length = 512, updatable = false)
    private String originalFilename;

    @Column(name = "content_type", nullable = false, length = 160, updatable = false)
    private String contentType;

    @Enumerated(EnumType.STRING)
    @Column(name = "media_category", nullable = false, length = 32, updatable = false)
    private DocumentMediaCategory mediaCategory;

    @Column(name = "file_size_bytes", nullable = false, updatable = false)
    private long fileSizeBytes;

    @Column(name = "sha256", nullable = false, length = 64, updatable = false)
    private String sha256;

    /** Private relative key, intentionally omitted from all API response types. */
    @Column(name = "storage_path", nullable = false, length = 500, updatable = false)
    private String storagePath;

    @Enumerated(EnumType.STRING)
    @Column(name = "document_status", nullable = false, length = 32)
    private DocumentStatus status;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected StoredDocument() {
    }

    public static StoredDocument uploaded(
            UUID id,
            UUID workspaceId,
            UUID ownerId,
            String originalFilename,
            String contentType,
            DocumentMediaCategory mediaCategory,
            long fileSizeBytes,
            String sha256,
            String storagePath) {
        StoredDocument document = new StoredDocument();
        document.id = id;
        document.workspaceId = workspaceId;
        document.ownerId = ownerId;
        document.originalFilename = originalFilename;
        document.contentType = contentType;
        document.mediaCategory = mediaCategory;
        document.fileSizeBytes = fileSizeBytes;
        document.sha256 = sha256;
        document.storagePath = storagePath;
        document.status = DocumentStatus.UPLOADED;
        return document;
    }

    @PrePersist
    void onCreate() {
        createdAt = Instant.now();
    }

    public UUID getId() { return id; }
    public UUID getWorkspaceId() { return workspaceId; }
    public UUID getOwnerId() { return ownerId; }
    public String getOriginalFilename() { return originalFilename; }
    public String getContentType() { return contentType; }
    public DocumentMediaCategory getMediaCategory() { return mediaCategory; }
    public long getFileSizeBytes() { return fileSizeBytes; }
    public String getSha256() { return sha256; }
    public String getStoragePath() { return storagePath; }
    public DocumentStatus getStatus() { return status; }
    public Instant getCreatedAt() { return createdAt; }
}
