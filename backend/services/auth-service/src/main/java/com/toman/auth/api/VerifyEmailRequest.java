package com.toman.auth.api;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record VerifyEmailRequest(
        @NotBlank @Email String email,
        @NotBlank @Pattern(regexp = "^[0-9]{3,10}$", message = "must be a numeric verification code") String code
) {
}
