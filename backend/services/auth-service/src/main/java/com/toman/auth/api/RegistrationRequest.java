package com.toman.auth.api;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record RegistrationRequest(
        @NotBlank @Size(max = 120) String fullName,
        @NotBlank @Email @Size(max = 254) String email,
        @NotBlank @Pattern(regexp = "^\\+?[1-9][0-9]{7,14}$", message = "must be an E.164-style mobile number") String mobileNumber,
        @NotBlank @Size(min = 10, max = 128) String password
) {
}
