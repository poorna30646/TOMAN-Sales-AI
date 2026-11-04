package ai.toman.jarvis.api;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record OwnerDecisionRequest(
        @NotNull Boolean approved,
        @Size(max = 1_000) String note) {
}
