package ai.toman.contracts;

import java.time.Instant;
import java.util.List;

/**
 * Transport shape for a failed request. It intentionally does not expose
 * exception names, stack traces, database details, credentials, or tokens.
 */
public record ApiError(
        Instant timestamp,
        String code,
        String message,
        String correlationId,
        List<FieldViolation> violations
) {
    public ApiError {
        violations = violations == null ? List.of() : List.copyOf(violations);
    }
}
