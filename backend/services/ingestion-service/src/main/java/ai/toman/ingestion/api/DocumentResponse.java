package ai.toman.ingestion.api;

import ai.toman.ingestion.domain.StoredDocument;
import java.time.Instant;
import java.util.UUID;

/** Never exposes the server-side storage key or filesystem path. */
public record DocumentResponse(
        UUID id,
        String filename,
        String contentType,
        String mediaCategory,
        long sizeBytes,
        String sha256,
        String status,
        Instant createdAt) {

    public static DocumentResponse from(StoredDocument document) {
        return new DocumentResponse(
                document.getId(),
                document.getOriginalFilename(),
                document.getContentType(),
                document.getMediaCategory().name(),
                document.getFileSizeBytes(),
                document.getSha256(),
                document.getStatus().name(),
                document.getCreatedAt());
    }
}
