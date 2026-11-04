package ai.toman.ingestion.storage;

import java.util.UUID;

/** Private storage metadata; never returned directly by the REST API. */
public record StoredFile(UUID documentId, String storagePath, long sizeBytes, String sha256) {
}
