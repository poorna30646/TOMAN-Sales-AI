package ai.toman.gateway;

import static org.assertj.core.api.Assertions.assertThat;

import ai.toman.contracts.RequestHeaders;
import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

class CorrelationIdFilterTests {

    private final CorrelationIdFilter filter = new CorrelationIdFilter();

    @Test
    void createsAndForwardsACorrelationIdWhenItIsMissing() throws Exception {
        var request = new MockHttpServletRequest();
        var response = new MockHttpServletResponse();

        FilterChain chain = (forwardedRequest, ignoredResponse) -> assertThat(
                ((jakarta.servlet.http.HttpServletRequest) forwardedRequest)
                        .getHeader(RequestHeaders.CORRELATION_ID)
        ).isNotBlank();

        filter.doFilter(request, response, chain);

        assertThat(response.getHeader(RequestHeaders.CORRELATION_ID)).isNotBlank();
    }
}
