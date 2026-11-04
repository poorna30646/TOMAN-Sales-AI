package com.toman.auth.security;

import com.toman.auth.config.AuthProperties;
import io.jsonwebtoken.JwtException;
import org.junit.jupiter.api.Test;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class JwtTokenServiceTest {

    @Test
    void issuesAndParsesAnAccessTokenWithTheSessionBinding() {
        JwtTokenService service = new JwtTokenService(properties("toman-auth-test"));

        IssuedAccessToken issued = service.issue("user-123", "session-456", "owner@example.com");
        AccessTokenClaims claims = service.parse(issued.value());

        assertThat(claims.userId()).isEqualTo("user-123");
        assertThat(claims.sessionId()).isEqualTo("session-456");
        assertThat(claims.email()).isEqualTo("owner@example.com");
        assertThat(claims.expiresAt()).isAfter(issued.expiresAt().minusSeconds(1));
    }

    @Test
    void rejectsATokenSignedForAnotherIssuer() {
        JwtTokenService issuingService = new JwtTokenService(properties("issuer-a"));
        JwtTokenService validatingService = new JwtTokenService(properties("issuer-b"));

        String token = issuingService.issue("user-123", "session-456", "owner@example.com").value();

        assertThatThrownBy(() -> validatingService.parse(token)).isInstanceOf(JwtException.class);
    }

    private AuthProperties properties(String issuer) {
        AuthProperties properties = new AuthProperties();
        properties.setIssuer(issuer);
        properties.getJwt().setSigningKeyBase64("aSOSUjgWSXMhoEinNdBqkm/BiKehjWAFFpnKVIaA664=");
        properties.getJwt().setAccessTokenTtl(Duration.ofMinutes(15));
        return properties;
    }
}
