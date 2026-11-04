package com.toman.auth.service;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class RefreshTokenFactoryTest {

    private final RefreshTokenFactory tokenFactory = new RefreshTokenFactory();

    @Test
    void createsOpaqueHighEntropyTokensAndHashesThemDeterministically() {
        String first = tokenFactory.create();
        String second = tokenFactory.create();

        assertThat(first).isNotEqualTo(second);
        assertThat(first).hasSizeGreaterThanOrEqualTo(80);
        assertThat(tokenFactory.hash(first))
                .hasSize(64)
                .isEqualTo(tokenFactory.hash(first))
                .isNotEqualTo(first);
    }
}
