package com.toman.auth.security;

import java.time.Instant;

public record AccessTokenClaims(String userId, String sessionId, String email, Instant expiresAt) {
}
