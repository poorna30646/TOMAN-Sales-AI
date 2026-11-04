package ai.toman.notification.api;

import java.time.Instant;

public record MarkAllReadResponse(int markedReadCount, Instant readAt) {
}
