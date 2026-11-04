package ai.toman.jarvis.api;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateAgentTaskRequest(
        @Size(max = 180) String title,
        @NotBlank @Size(max = 12_000) String prompt) {

    public String effectiveTitle() {
        return title == null || title.isBlank() ? "Jarvis sales plan" : title.trim();
    }
}
