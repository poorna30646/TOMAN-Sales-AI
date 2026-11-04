package ai.toman.jarvis.notification;

import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/** Sends only server-to-server, owner-scoped events; no Meta or mobile key crosses this boundary. */
@Component
public class NotificationServiceClient {

    private final NotificationDeliveryProperties properties;
    private final RestClient restClient;

    public NotificationServiceClient(NotificationDeliveryProperties properties) {
        this.properties = properties;
        this.restClient = RestClient.builder().baseUrl(
                properties.baseUrl() == null || properties.baseUrl().isBlank()
                        ? "http://localhost:8087"
                        : properties.baseUrl()).build();
    }

    public boolean configured() {
        return properties.configured();
    }

    public void sendReviewRequired(ReviewNotificationOutboxEvent event) {
        try {
            restClient.post()
                    .uri("/internal/v1/notifications")
                    .contentType(MediaType.APPLICATION_JSON)
                    .header("X-TOMAN-Internal-Key", properties.internalApiKey())
                    .body(new InternalNotificationPayload(
                            event.getWorkspaceId(),
                            event.getOwnerId(),
                            "REVIEW_REQUIRED",
                            event.getTitle(),
                            event.getMessage(),
                            "JARVIS_TASK",
                            event.getTaskId()))
                    .retrieve()
                    .toBodilessEntity();
        } catch (RestClientException exception) {
            throw new NotificationDeliveryException("Notification Service could not accept the review event.", exception);
        }
    }

    private record InternalNotificationPayload(
            java.util.UUID workspaceId,
            java.util.UUID ownerId,
            String type,
            String title,
            String message,
            String referenceType,
            java.util.UUID referenceId) {
    }
}
