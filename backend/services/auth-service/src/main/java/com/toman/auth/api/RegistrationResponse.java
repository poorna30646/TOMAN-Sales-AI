package com.toman.auth.api;

public record RegistrationResponse(
        UserResponse user,
        boolean verificationRequired,
        String developmentVerificationCode
) {
}
