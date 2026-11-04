package com.toman.auth.api;

import com.toman.auth.domain.UserAccount;

import java.time.Instant;

public record UserResponse(
        String id,
        String fullName,
        String email,
        String mobileNumber,
        boolean emailVerified,
        Instant createdAt
) {
    public static UserResponse from(UserAccount user) {
        return new UserResponse(
                user.getId(),
                user.getFullName(),
                user.getEmail(),
                user.getMobileNumber(),
                user.isActive(),
                user.getCreatedAt()
        );
    }
}
