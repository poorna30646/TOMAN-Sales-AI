package ai.toman.gateway;

import ai.toman.contracts.RequestHeaders;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Enumeration;
import java.util.List;
import java.util.UUID;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Gives every ingress request a correlation ID and makes it available to
 * downstream Gateway MVC routes. It does not log access tokens or request bodies.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class CorrelationIdFilter extends OncePerRequestFilter {

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        String correlationId = request.getHeader(RequestHeaders.CORRELATION_ID);
        if (!StringUtils.hasText(correlationId)) {
            correlationId = UUID.randomUUID().toString();
        }

        response.setHeader(RequestHeaders.CORRELATION_ID, correlationId);
        filterChain.doFilter(new CorrelationIdRequestWrapper(request, correlationId), response);
    }

    private static final class CorrelationIdRequestWrapper extends HttpServletRequestWrapper {

        private final String correlationId;

        private CorrelationIdRequestWrapper(HttpServletRequest request, String correlationId) {
            super(request);
            this.correlationId = correlationId;
        }

        @Override
        public String getHeader(String name) {
            if (RequestHeaders.CORRELATION_ID.equalsIgnoreCase(name)) {
                return correlationId;
            }
            return super.getHeader(name);
        }

        @Override
        public Enumeration<String> getHeaders(String name) {
            if (RequestHeaders.CORRELATION_ID.equalsIgnoreCase(name)) {
                return Collections.enumeration(List.of(correlationId));
            }
            return super.getHeaders(name);
        }

        @Override
        public Enumeration<String> getHeaderNames() {
            List<String> names = new ArrayList<>();
            Enumeration<String> originalNames = super.getHeaderNames();
            while (originalNames.hasMoreElements()) {
                names.add(originalNames.nextElement());
            }
            if (names.stream().noneMatch(RequestHeaders.CORRELATION_ID::equalsIgnoreCase)) {
                names.add(RequestHeaders.CORRELATION_ID);
            }
            return Collections.enumeration(names);
        }
    }
}
