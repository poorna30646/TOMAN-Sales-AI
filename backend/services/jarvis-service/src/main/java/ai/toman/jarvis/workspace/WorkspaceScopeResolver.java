package ai.toman.jarvis.workspace;

import ai.toman.contracts.RequestHeaders;
import ai.toman.jarvis.security.GatewayTrustProperties;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

/**
 * Safely resolves an owner's workspace after the gateway trust filter has
 * authenticated the internal request. This is a resilient fallback for MVC
 * proxy body requests where a derived workspace header is unavailable.
 */
@Component
public class WorkspaceScopeResolver {

    private final GatewayTrustProperties gatewayTrust;
    private final RestClient restClient;

    public WorkspaceScopeResolver(
            WorkspaceScopeProperties properties,
            GatewayTrustProperties gatewayTrust) {
        this.gatewayTrust = gatewayTrust;
        this.restClient = RestClient.builder().baseUrl(properties.baseUrl()).build();
    }

    public UUID resolve(UUID ownerId, UUID suppliedWorkspaceId) {
        if (suppliedWorkspaceId != null) {
            return suppliedWorkspaceId;
        }
        if (!StringUtils.hasText(gatewayTrust.sharedKey())) {
            throw unavailable();
        }
        try {
            WorkspaceScopeResponse response = restClient.get()
                    .uri("/internal/v1/workspaces/current")
                    .header(RequestHeaders.AUTHENTICATED_USER_ID, ownerId.toString())
                    .header(RequestHeaders.GATEWAY_TRUST_KEY, gatewayTrust.sharedKey())
                    .retrieve()
                    .body(WorkspaceScopeResponse.class);
            if (response == null || response.workspaceId() == null) {
                throw unavailable();
            }
            return response.workspaceId();
        } catch (RestClientResponseException exception) {
            if (exception.getStatusCode().value() == HttpStatus.NOT_FOUND.value()) {
                throw new WorkspaceScopeException(
                        HttpStatus.CONFLICT.value(),
                        "Finish business setup before asking Jarvis to work on your sales plan.");
            }
            throw unavailable();
        } catch (WorkspaceScopeException exception) {
            throw exception;
        } catch (RuntimeException exception) {
            throw unavailable();
        }
    }

    private WorkspaceScopeException unavailable() {
        return new WorkspaceScopeException(
                HttpStatus.SERVICE_UNAVAILABLE.value(),
                "Jarvis cannot verify your workspace right now. Please try again in a moment.");
    }

    private record WorkspaceScopeResponse(UUID workspaceId) {
    }
}
