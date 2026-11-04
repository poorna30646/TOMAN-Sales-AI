package ai.toman.gateway.workspace;

import ai.toman.contracts.RequestHeaders;
import ai.toman.gateway.GatewayAuthProperties;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

/**
 * Resolves the current workspace on the server side. The mobile app never
 * chooses a workspace header, so it cannot access another owner's data by
 * changing a client request header.
 */
@Component
public class WorkspaceScopeResolver {

    private final GatewayAuthProperties properties;
    private final RestClient restClient;

    public WorkspaceScopeResolver(GatewayAuthProperties properties) {
        this.properties = properties;
        this.restClient = RestClient.builder()
                .baseUrl(properties.getWorkspaceServiceUrl())
                .build();
    }

    public UUID resolve(UUID ownerId) {
        if (!StringUtils.hasText(properties.getDownstreamSharedKey())) {
            throw new WorkspaceScopeLookupException(
                    HttpStatus.SERVICE_UNAVAILABLE.value(),
                    "GATEWAY_TRUST_NOT_CONFIGURED",
                    "The secure gateway-to-service connection is not configured.");
        }
        try {
            WorkspaceScopeResponse response = restClient.get()
                    .uri("/internal/v1/workspaces/current")
                    .header(RequestHeaders.AUTHENTICATED_USER_ID, ownerId.toString())
                    .header(RequestHeaders.GATEWAY_TRUST_KEY, properties.getDownstreamSharedKey())
                    .retrieve()
                    .body(WorkspaceScopeResponse.class);
            if (response == null || response.workspaceId() == null) {
                throw unavailable();
            }
            return response.workspaceId();
        } catch (RestClientResponseException exception) {
            if (exception.getStatusCode().value() == HttpStatus.NOT_FOUND.value()) {
                throw new WorkspaceScopeLookupException(
                        HttpStatus.CONFLICT.value(),
                        "WORKSPACE_SETUP_REQUIRED",
                        "Finish business setup before using this feature.");
            }
            throw unavailable();
        } catch (WorkspaceScopeLookupException exception) {
            throw exception;
        } catch (RuntimeException exception) {
            throw unavailable();
        }
    }

    private WorkspaceScopeLookupException unavailable() {
        return new WorkspaceScopeLookupException(
                HttpStatus.SERVICE_UNAVAILABLE.value(),
                "WORKSPACE_SCOPE_UNAVAILABLE",
                "Workspace scope is temporarily unavailable. Try again shortly.");
    }

    private record WorkspaceScopeResponse(UUID workspaceId) {
    }
}
