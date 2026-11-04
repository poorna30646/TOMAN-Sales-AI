package com.toman.auth.service;

import org.springframework.stereotype.Component;

@Component
public class PasswordPolicy {

    public void validate(String password) {
        if (password == null || password.length() < 10) {
            throw AuthDomainException.badRequest("WEAK_PASSWORD", "Password must contain at least 10 characters.");
        }
        if (password.chars().noneMatch(Character::isUpperCase)
                || password.chars().noneMatch(Character::isLowerCase)
                || password.chars().noneMatch(Character::isDigit)) {
            throw AuthDomainException.badRequest(
                    "WEAK_PASSWORD",
                    "Password must include upper-case, lower-case, and numeric characters."
            );
        }
    }
}
