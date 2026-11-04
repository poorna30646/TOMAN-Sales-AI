package ai.toman.gateway;

import jakarta.validation.constraints.NotBlank;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * HMAC validation configuration shared with auth-service only through server
 * environment variables. It must never be placed in the React Native client.
 */
@Validated
@ConfigurationProperties(prefix = "toman.gateway.auth")
public class GatewayAuthProperties {

    @NotBlank
    private String issuer = "toman-auth-service";

    @NotBlank
    private String signingKeyBase64;

    /** Required for downstream services to reject direct/mobile header forgery. */
    private String downstreamSharedKey;

    /** Internal address for the one-owner/one-workspace lookup. */
    private String workspaceServiceUrl = "http://localhost:8082";

    public String getIssuer() {
        return issuer;
    }

    public void setIssuer(String issuer) {
        this.issuer = issuer;
    }

    public String getSigningKeyBase64() {
        return signingKeyBase64;
    }

    public void setSigningKeyBase64(String signingKeyBase64) {
        this.signingKeyBase64 = signingKeyBase64;
    }

    public String getDownstreamSharedKey() {
        return downstreamSharedKey;
    }

    public void setDownstreamSharedKey(String downstreamSharedKey) {
        this.downstreamSharedKey = downstreamSharedKey;
    }

    public String getWorkspaceServiceUrl() {
        return workspaceServiceUrl;
    }

    public void setWorkspaceServiceUrl(String workspaceServiceUrl) {
        this.workspaceServiceUrl = workspaceServiceUrl;
    }
}
