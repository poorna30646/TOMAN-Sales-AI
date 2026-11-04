package com.toman.auth.api;

import com.toman.auth.security.AuthenticatedPrincipal;
import com.toman.auth.service.AuthService;
import com.toman.auth.service.ClientMetadata;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public RegistrationResponse register(@Valid @RequestBody RegistrationRequest request) {
        return authService.register(request);
    }

    @PostMapping("/verify-email")
    public AuthSessionResponse verifyEmail(
            @Valid @RequestBody VerifyEmailRequest request,
            HttpServletRequest servletRequest
    ) {
        return authService.verifyEmail(request, ClientMetadata.from(servletRequest));
    }

    @PostMapping("/resend-verification")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public VerificationDeliveryResponse resendVerification(@Valid @RequestBody ResendVerificationRequest request) {
        return authService.resendVerification(request);
    }

    @PostMapping("/login")
    public AuthSessionResponse login(
            @Valid @RequestBody LoginRequest request,
            HttpServletRequest servletRequest
    ) {
        return authService.login(request, ClientMetadata.from(servletRequest));
    }

    @PostMapping("/refresh")
    public AuthSessionResponse refresh(
            @Valid @RequestBody RefreshTokenRequest request,
            HttpServletRequest servletRequest
    ) {
        return authService.refresh(request, ClientMetadata.from(servletRequest));
    }

    @PostMapping("/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void logout(@AuthenticationPrincipal AuthenticatedPrincipal principal) {
        authService.logout(principal.sessionId());
    }

    @GetMapping("/me")
    public UserResponse me(@AuthenticationPrincipal AuthenticatedPrincipal principal) {
        return authService.currentUser(principal.userId());
    }
}
