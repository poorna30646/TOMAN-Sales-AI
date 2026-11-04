package com.toman.auth.api;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RefreshTokenRequest(
        @NotBlank @Size(min = 32, max = 1024) String refreshToken
) {
}
