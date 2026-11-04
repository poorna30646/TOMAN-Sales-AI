package com.toman.auth.service;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class PasswordPolicyTest {

    private final PasswordPolicy passwordPolicy = new PasswordPolicy();

    @Test
    void acceptsAReasonablyStrongPassword() {
        assertThatCode(() -> passwordPolicy.validate("StrongPass2026"))
                .doesNotThrowAnyException();
    }

    @Test
    void rejectsAWeakPassword() {
        assertThatThrownBy(() -> passwordPolicy.validate("password"))
                .isInstanceOf(AuthDomainException.class)
                .hasMessageContaining("at least 10 characters");
    }
}
