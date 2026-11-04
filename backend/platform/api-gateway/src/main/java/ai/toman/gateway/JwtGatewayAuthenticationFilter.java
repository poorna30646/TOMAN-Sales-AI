package ai.toman.gateway;

import ai.toman.contracts.RequestHeaders;
import ai.toman.gateway.workspace.WorkspaceScopeLookupException;
import ai.toman.gateway.workspace.WorkspaceScopeResolver;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Collections;
import java.util.Enumeration;
import java.util.List;
import java.util.UUID;
import javax.crypto.SecretKey;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * The mobile client reaches only the gateway. This filter validates TOMAN's
 * access JWT and overwrites any client-supplied owner header before routing.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
public class JwtGatewayAuthenticationFilter extends OncePerRequestFilter {

    private static final String BEARER_PREFIX = "Bearer ";
    private final GatewayAuthProperties properties;
    private final SecretKey signingKey;
    private final WorkspaceScopeResolver workspaceScopeResolver;

    public JwtGatewayAuthenticationFilter(
            GatewayAuthProperties properties,
            WorkspaceScopeResolver workspaceScopeResolver) {
        this.properties = properties;
        this.workspaceScopeResolver = workspaceScopeResolver;
        try {
            byte[] key = Base64.getDecoder().decode(properties.getSigningKeyBase64());
            if (key.length < 32) {
                throw new IllegalStateException("Gateway JWT signing key must contain at least 256 bits.");
            }
            this.signingKey = Keys.hmacShaKeyFor(key);
        } catch (IllegalArgumentException exception) {
            throw new IllegalStateException("Gateway JWT signing key must be Base64 encoded.", exception);
        }
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI();
        return path.equals("/actuator/health")
                || path.equals("/actuator/info")
                || path.equals("/api/v1/auth/register")
                || path.equals("/api/v1/auth/verify-email")
                || path.equals("/api/v1/auth/resend-verification")
                || path.equals("/api/v1/auth/login")
                || path.equals("/api/v1/auth/refresh");
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        String authorization = request.getHeader("Authorization");
        if (!StringUtils.hasText(authorization) || !authorization.startsWith(BEARER_PREFIX)) {
            reject(response, "A valid TOMAN access token is required.");
            return;
        }

        try {
            Claims claims = Jwts.parser()
                    .verifyWith(signingKey)
                    .requireIssuer(properties.getIssuer())
                    .build()
                    .parseSignedClaims(authorization.substring(BEARER_PREFIX.length()).trim())
                    .getPayload();
            String userId = claims.getSubject();
            String sessionId = claims.get("sid", String.class);
            if (!StringUtils.hasText(userId) || !StringUtils.hasText(sessionId)) {
                reject(response, "A valid TOMAN access token is required.");
                return;
            }
            if (!StringUtils.hasText(properties.getDownstreamSharedKey())) {
                reject(response, HttpServletResponse.SC_SERVICE_UNAVAILABLE,
                        "GATEWAY_TRUST_NOT_CONFIGURED",
                        "The secure gateway-to-service connection is not configured.");
                return;
            }
            UUID workspaceId = requiresWorkspaceScope(request.getRequestURI())
                    ? workspaceScopeResolver.resolve(UUID.fromString(userId))
                    : null;
            filterChain.doFilter(new AuthenticatedRequestWrapper(
                    request,
                    userId,
                    workspaceId == null ? null : workspaceId.toString(),
                    properties.getDownstreamSharedKey()), response);
        } catch (WorkspaceScopeLookupException exception) {
            reject(response, exception.status(), exception.code(), exception.getMessage());
        } catch (JwtException | IllegalArgumentException exception) {
            reject(response, "A valid TOMAN access token is required.");
        }
    }

    private boolean requiresWorkspaceScope(String path) {
        return path.startsWith("/api/v1/documents")
                || path.startsWith("/api/v1/jarvis")
                || path.startsWith("/api/v1/notifications");
    }

    private void reject(HttpServletResponse response, String message) throws IOException {
        reject(response, HttpServletResponse.SC_UNAUTHORIZED, "UNAUTHENTICATED", message);
    }

    private void reject(HttpServletResponse response, int status, String code, String message) throws IOException {
        response.setStatus(status);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding(StandardCharsets.UTF_8);
        response.getWriter().write("{\"code\":\"" + code + "\",\"message\":\"" + message + "\"}");
    }

    private static final class AuthenticatedRequestWrapper extends HttpServletRequestWrapper {

        private final String userId;
        private final String workspaceId;
        private final String gatewayTrustKey;

        private AuthenticatedRequestWrapper(
                HttpServletRequest request,
                String userId,
                String workspaceId,
                String gatewayTrustKey) {
            super(request);
            this.userId = userId;
            this.workspaceId = workspaceId;
            this.gatewayTrustKey = gatewayTrustKey;
        }

        @Override
        public String getHeader(String name) {
            if (RequestHeaders.AUTHENTICATED_USER_ID.equalsIgnoreCase(name)) {
                return userId;
            }
            if (RequestHeaders.WORKSPACE_ID.equalsIgnoreCase(name)) {
                return workspaceId;
            }
            if (RequestHeaders.GATEWAY_TRUST_KEY.equalsIgnoreCase(name)) {
                return gatewayTrustKey;
            }
            return super.getHeader(name);
        }

        @Override
        public Enumeration<String> getHeaders(String name) {
            if (RequestHeaders.AUTHENTICATED_USER_ID.equalsIgnoreCase(name)) {
                return Collections.enumeration(List.of(userId));
            }
            if (RequestHeaders.WORKSPACE_ID.equalsIgnoreCase(name)) {
                return workspaceId == null ? Collections.emptyEnumeration() : Collections.enumeration(List.of(workspaceId));
            }
            if (RequestHeaders.GATEWAY_TRUST_KEY.equalsIgnoreCase(name)) {
                return Collections.enumeration(List.of(gatewayTrustKey));
            }
            return super.getHeaders(name);
        }

        @Override
        public Enumeration<String> getHeaderNames() {
            List<String> names = new ArrayList<>();
            Enumeration<String> original = super.getHeaderNames();
            while (original.hasMoreElements()) {
                String name = original.nextElement();
                if (!RequestHeaders.AUTHENTICATED_USER_ID.equalsIgnoreCase(name)
                        && !RequestHeaders.WORKSPACE_ID.equalsIgnoreCase(name)
                        && !RequestHeaders.GATEWAY_TRUST_KEY.equalsIgnoreCase(name)) {
                    names.add(name);
                }
            }
            names.add(RequestHeaders.AUTHENTICATED_USER_ID);
            names.add(RequestHeaders.GATEWAY_TRUST_KEY);
            if (workspaceId != null) {
                names.add(RequestHeaders.WORKSPACE_ID);
            }
            return Collections.enumeration(names);
        }
    }
}
