package ai.toman.notification.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "toman.notifications")
public record NotificationProperties(String internalApiKey) {
}
