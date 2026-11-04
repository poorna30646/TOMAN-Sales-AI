package ai.toman.gateway;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.servlet.http.HttpServletRequest;
import ai.toman.gateway.workspace.WorkspaceScopeResolver;
import java.time.Instant;
import java.util.Base64;
import java.util.Date;
import javax.crypto.SecretKey;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.assertj.core.api.Assertions.assertThat;

class JwtGatewayAuthenticationFilterTest {

    private static final String SECRET = "aSOSUjgWSXMhoEinNdBqkm/BiKehjWAFFpnKVIaA664=";

    @Test
    void overwritesASpoofedOwnerHeaderWithVerifiedJwtSubject() throws Exception {
        GatewayAuthProperties properties = properties();
        JwtGatewayAuthenticationFilter filter = new JwtGatewayAuthenticationFilter(properties, new WorkspaceScopeResolver(properties));
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/settings");
        request.addHeader("Authorization", "Bearer " + token("real-owner"));
        request.addHeader("X-TOMAN-User-Id", "spoofed-owner");
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();

        filter.doFilter(request, response, chain);

        assertThat(response.getStatus()).isEqualTo(200);
        assertThat(((HttpServletRequest) chain.getRequest()).getHeader("X-TOMAN-User-Id"))
                .isEqualTo("real-owner");
    }

    @Test
    void rejectsMissingAccessTokenOnProtectedRoute() throws Exception {
        GatewayAuthProperties properties = properties();
        JwtGatewayAuthenticationFilter filter = new JwtGatewayAuthenticationFilter(properties, new WorkspaceScopeResolver(properties));
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/notifications");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, new MockFilterChain());

        assertThat(response.getStatus()).isEqualTo(401);
        assertThat(response.getContentAsString()).contains("UNAUTHENTICATED");
    }

    private GatewayAuthProperties properties() {
        GatewayAuthProperties properties = new GatewayAuthProperties();
        properties.setIssuer("toman-auth-service");
        properties.setSigningKeyBase64(SECRET);
        properties.setDownstreamSharedKey("test-gateway-trust-key");
        properties.setWorkspaceServiceUrl("http://localhost:8082");
        return properties;
    }

    private String token(String subject) {
        SecretKey key = Keys.hmacShaKeyFor(Base64.getDecoder().decode(SECRET));
        Instant now = Instant.now();
        return Jwts.builder()
                .issuer("toman-auth-service")
                .subject(subject)
                .claim("sid", "session-id")
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plusSeconds(60)))
                .signWith(key)
                .compact();
    }
}
