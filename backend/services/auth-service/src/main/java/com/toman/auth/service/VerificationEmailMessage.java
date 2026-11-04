package com.toman.auth.service;

import java.time.Instant;

public record VerificationEmailMessage(String recipientEmail, String code, Instant expiresAt) {
}
