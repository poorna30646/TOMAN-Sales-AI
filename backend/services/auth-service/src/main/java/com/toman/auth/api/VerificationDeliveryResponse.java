package com.toman.auth.api;

public record VerificationDeliveryResponse(
        boolean accepted,
        String developmentVerificationCode
) {
}
