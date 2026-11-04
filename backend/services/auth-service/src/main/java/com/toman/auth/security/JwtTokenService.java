package com.toman.auth.security;

import com.toman.auth.config.AuthProperties;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.time.Instant;
import java.util.Base64;
import java.util.Date;

@Service
public class JwtTokenService {

    private final AuthProperties properties;
    private final SecretKey signingKey;

    public JwtTokenService(AuthProperties properties) {
        this.properties = properties;
        byte[] keyBytes;
        try {
            keyBytes = Base64.getDecoder().decode(properties.getJwt().getSigningKeyBase64());
        } catch (IllegalArgumentException exception) {
            throw new IllegalStateException("auth.jwt.signing-key-base64 must be valid Base64.", exception);
        }
        if (keyBytes.length < 32) {
            throw new IllegalStateException("auth.jwt.signing-key-base64 must contain at least 256 bits.");
        }
        this.signingKey = Keys.hmacShaKeyFor(keyBytes);
    }

    public IssuedAccessToken issue(String userId, String sessionId, String email) {
        Instant now = Instant.now();
        Instant expiresAt = now.plus(properties.getJwt().getAccessTokenTtl());
        String token = Jwts.builder()
                .issuer(properties.getIssuer())
                .subject(userId)
                .claim("sid", sessionId)
                .claim("email", email)
                .issuedAt(Date.from(now))
                .expiration(Date.from(expiresAt))
                .signWith(signingKey)
                .compact();
        return new IssuedAccessToken(token, expiresAt);
    }

    public AccessTokenClaims parse(String token) {
        Claims claims = Jwts.parser()
                .verifyWith(signingKey)
                .requireIssuer(properties.getIssuer())
                .build()
                .parseSignedClaims(token)
                .getPayload();

        String userId = claims.getSubject();
        String sessionId = claims.get("sid", String.class);
        String email = claims.get("email", String.class);
        Date expiry = claims.getExpiration();
        if (isBlank(userId) || isBlank(sessionId) || isBlank(email) || expiry == null) {
            throw new IllegalArgumentException("Access token has required claims missing.");
        }
        return new AccessTokenClaims(userId, sessionId, email, expiry.toInstant());
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
