package com.toman.auth.service;

import java.time.Instant;

public record VerificationIssue(String developmentCode, Instant expiresAt) {
}
