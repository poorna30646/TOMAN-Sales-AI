package ai.toman.workspace.security;

import ai.toman.contracts.RequestHeaders;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/** Rejects direct/mobile calls so only the verified API gateway can supply owner headers. */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class GatewayTrustFilter extends OncePerRequestFilter {

    private final GatewayTrustProperties properties;

    public GatewayTrustFilter(GatewayTrustProperties properties) {
        this.properties = properties;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return request.getRequestURI().startsWith("/actuator/");
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {
        String expected = properties.sharedKey();
        String supplied = request.getHeader(RequestHeaders.GATEWAY_TRUST_KEY);
        if (expected == null || expected.isBlank() || supplied == null
                || !MessageDigest.isEqual(expected.getBytes(StandardCharsets.UTF_8), supplied.getBytes(StandardCharsets.UTF_8))) {
            response.setStatus(HttpServletResponse.SC_FORBIDDEN);
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.getWriter().write("{\"code\":\"GATEWAY_TRUST_REQUIRED\",\"message\":\"Request must be routed through the TOMAN API gateway.\"}");
            return;
        }
        filterChain.doFilter(request, response);
    }
}
