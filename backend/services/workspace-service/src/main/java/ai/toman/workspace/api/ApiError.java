package ai.toman.workspace.api;

import java.time.Instant;
import java.util.Map;

public record ApiError(String code, String message, Instant timestamp, Map<String, String> fieldErrors) {
}
