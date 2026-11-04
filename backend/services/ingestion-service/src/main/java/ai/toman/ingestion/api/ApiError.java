package ai.toman.ingestion.api;

import java.time.Instant;
import java.util.Map;

/** A deliberately small error envelope which never exposes filesystem paths. */
public record ApiError(
        String code,
        String message,
        Instant timestamp,
        Map<String, String> fieldErrors) {
}
