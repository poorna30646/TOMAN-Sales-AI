package ai.toman.jarvis.workspace;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "toman.workspace-scope")
public record WorkspaceScopeProperties(String baseUrl) {
}
