package ai.toman.notification.service;

import ai.toman.notification.config.NotificationProperties;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import org.springframework.stereotype.Component;

/** Protects the event-creation route from mobile/browser clients. */
@Component
public class InternalRequestAuthorizer {

    private final NotificationProperties properties;

    public InternalRequestAuthorizer(NotificationProperties properties) {
        this.properties = properties;
    }

    public void assertAuthorized(String suppliedKey) {
        String configuredKey = properties.internalApiKey();
        if (configuredKey == null || configuredKey.isBlank() || suppliedKey == null) {
            throw new InternalRequestForbiddenException();
        }

        boolean same = MessageDigest.isEqual(
                configuredKey.getBytes(StandardCharsets.UTF_8),
                suppliedKey.getBytes(StandardCharsets.UTF_8));
        if (!same) {
            throw new InternalRequestForbiddenException();
        }
    }
}
