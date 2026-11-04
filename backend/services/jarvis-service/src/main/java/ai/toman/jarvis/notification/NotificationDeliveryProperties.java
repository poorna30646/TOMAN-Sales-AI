package ai.toman.jarvis.notification;

import org.springframework.boot.context.properties.ConfigurationProperties;

/** Server-only location and credential for Notification Service event delivery. */
@ConfigurationProperties(prefix = "toman.notification-delivery")
public record NotificationDeliveryProperties(String baseUrl, String internalApiKey, boolean enabled) {

    public boolean configured() {
        return enabled
                && baseUrl != null && !baseUrl.isBlank()
                && internalApiKey != null && !internalApiKey.isBlank();
    }
}
