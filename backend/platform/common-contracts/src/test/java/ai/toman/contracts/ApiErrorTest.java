package ai.toman.contracts;

import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Instant;
import org.junit.jupiter.api.Test;

class ApiErrorTest {

    @Test
    void normalizesNullViolationsToAnEmptyList() {
        var error = new ApiError(Instant.now(), "VALIDATION_FAILED", "Invalid request", "cid-1", null);

        assertTrue(error.violations().isEmpty());
    }
}
