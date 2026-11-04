package ai.toman.jarvis.meta;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "toman.meta")
public record MetaModelProperties(
        String baseUrl,
        String apiKey,
        String model,
        Duration timeout,
        boolean enabled) {

    public boolean configured() {
        return enabled && apiKey != null && !apiKey.isBlank();
    }
}
