package com.toman.auth.api;

import java.time.Instant;

public record AuthSessionResponse(
        String accessToken,
        String tokenType,
        Instant accessTokenExpiresAt,
        String refreshToken,
        Instant refreshTokenExpiresAt,
        UserResponse user
) {
}
