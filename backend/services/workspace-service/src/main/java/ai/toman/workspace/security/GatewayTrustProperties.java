package ai.toman.workspace.security;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "toman.gateway-trust")
public record GatewayTrustProperties(String sharedKey) {
}
