package com.toman.auth.service;

import com.toman.auth.api.AuthSessionResponse;
import com.toman.auth.api.LoginRequest;
import com.toman.auth.api.RegistrationRequest;
import com.toman.auth.api.RegistrationResponse;
import com.toman.auth.api.RefreshTokenRequest;
import com.toman.auth.api.ResendVerificationRequest;
import com.toman.auth.api.UserResponse;
import com.toman.auth.api.VerificationDeliveryResponse;
import com.toman.auth.api.VerifyEmailRequest;
import com.toman.auth.config.AuthProperties;
import com.toman.auth.domain.RefreshSession;
import com.toman.auth.domain.UserAccount;
import com.toman.auth.repository.RefreshSessionRepository;
import com.toman.auth.repository.UserAccountRepository;
import com.toman.auth.security.IssuedAccessToken;
import com.toman.auth.security.JwtTokenService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Locale;

@Service
public class AuthService {

    private final UserAccountRepository userAccountRepository;
    private final RefreshSessionRepository refreshSessionRepository;
    private final EmailVerificationService emailVerificationService;
    private final PasswordPolicy passwordPolicy;
    private final PasswordEncoder passwordEncoder;
    private final RefreshTokenFactory refreshTokenFactory;
    private final JwtTokenService jwtTokenService;
    private final AuthProperties properties;

    public AuthService(
            UserAccountRepository userAccountRepository,
            RefreshSessionRepository refreshSessionRepository,
            EmailVerificationService emailVerificationService,
            PasswordPolicy passwordPolicy,
            PasswordEncoder passwordEncoder,
            RefreshTokenFactory refreshTokenFactory,
            JwtTokenService jwtTokenService,
            AuthProperties properties
    ) {
        this.userAccountRepository = userAccountRepository;
        this.refreshSessionRepository = refreshSessionRepository;
        this.emailVerificationService = emailVerificationService;
        this.passwordPolicy = passwordPolicy;
        this.passwordEncoder = passwordEncoder;
        this.refreshTokenFactory = refreshTokenFactory;
        this.jwtTokenService = jwtTokenService;
        this.properties = properties;
    }

    @Transactional
    public RegistrationResponse register(RegistrationRequest request) {
        String email = normalizeEmail(request.email());
        String mobileNumber = normalizeMobileNumber(request.mobileNumber());
        String fullName = normalizeFullName(request.fullName());
        passwordPolicy.validate(request.password());

        if (userAccountRepository.existsByEmail(email)) {
            throw AuthDomainException.conflict("EMAIL_ALREADY_REGISTERED", "An account already uses this email address.");
        }
        if (userAccountRepository.existsByMobileNumber(mobileNumber)) {
            throw AuthDomainException.conflict("MOBILE_ALREADY_REGISTERED", "An account already uses this mobile number.");
        }

        UserAccount user = UserAccount.pendingVerification(
                fullName,
                email,
                mobileNumber,
                passwordEncoder.encode(request.password())
        );
        userAccountRepository.save(user);
        VerificationIssue verification = emailVerificationService.issue(user);
        return new RegistrationResponse(UserResponse.from(user), true, verification.developmentCode());
    }

    @Transactional
    public AuthSessionResponse verifyEmail(VerifyEmailRequest request, ClientMetadata metadata) {
        UserAccount user = findUserByEmail(request.email());
        if (user.isActive()) {
            throw AuthDomainException.conflict("EMAIL_ALREADY_VERIFIED", "This email address has already been verified.");
        }
        emailVerificationService.verify(user, request.code());
        user.markEmailVerified(Instant.now());
        user.markLoggedIn(Instant.now());
        return createSession(user, metadata);
    }

    @Transactional
    public VerificationDeliveryResponse resendVerification(ResendVerificationRequest request) {
        return userAccountRepository.findByEmail(normalizeEmail(request.email()))
                .map(user -> {
                    if (user.isActive()) {
                        throw AuthDomainException.conflict(
                                "EMAIL_ALREADY_VERIFIED",
                                "This email address is already verified. Please sign in."
                        );
                    }
                    VerificationIssue verification = emailVerificationService.issue(user);
                    return new VerificationDeliveryResponse(true, verification.developmentCode());
                })
                // Keep the public response identical when the email has no account.
                .orElseGet(() -> new VerificationDeliveryResponse(true, null));
    }

    @Transactional
    public AuthSessionResponse login(LoginRequest request, ClientMetadata metadata) {
        UserAccount user = userAccountRepository.findByEmail(normalizeEmail(request.email()))
                .orElseThrow(() -> invalidCredentials());
        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw invalidCredentials();
        }
        if (!user.isActive()) {
            throw AuthDomainException.forbidden(
                    "EMAIL_VERIFICATION_REQUIRED",
                    "Verify your email address before signing in."
            );
        }
        user.markLoggedIn(Instant.now());
        return createSession(user, metadata);
    }

    @Transactional
    public AuthSessionResponse refresh(RefreshTokenRequest request, ClientMetadata metadata) {
        RefreshSession existing = refreshSessionRepository.findByTokenHash(refreshTokenFactory.hash(request.refreshToken()))
                .orElseThrow(() -> invalidRefreshToken());
        Instant now = Instant.now();
        if (!existing.isActiveAt(now) || !existing.getUser().isActive()) {
            // A reused rotated token is a compromise signal: immediately invalidate its whole family.
            revokeFamily(existing.getFamilyId(), now);
            throw invalidRefreshToken();
        }

        String replacementRawToken = refreshTokenFactory.create();
        RefreshSession replacement = RefreshSession.rotate(
                existing.getUser(),
                existing.getFamilyId(),
                refreshTokenFactory.hash(replacementRawToken),
                now.plus(properties.getRefresh().getTokenTtl()),
                metadata.userAgent(),
                metadata.ipAddress()
        );
        refreshSessionRepository.save(replacement);
        existing.replaceWith(replacement.getId(), now);
        return sessionResponse(existing.getUser(), replacement, replacementRawToken);
    }

    @Transactional
    public void logout(String sessionId) {
        refreshSessionRepository.findById(sessionId)
                .ifPresent(session -> revokeFamily(session.getFamilyId(), Instant.now()));
    }

    @Transactional(readOnly = true)
    public UserResponse currentUser(String userId) {
        UserAccount user = userAccountRepository.findById(userId)
                .orElseThrow(() -> AuthDomainException.unauthorized(
                        "SESSION_INVALID",
                        "Your sign-in session is no longer active."
                ));
        return UserResponse.from(user);
    }

    private AuthSessionResponse createSession(UserAccount user, ClientMetadata metadata) {
        Instant now = Instant.now();
        String rawRefreshToken = refreshTokenFactory.create();
        RefreshSession session = RefreshSession.newFamily(
                user,
                refreshTokenFactory.hash(rawRefreshToken),
                now.plus(properties.getRefresh().getTokenTtl()),
                metadata.userAgent(),
                metadata.ipAddress()
        );
        refreshSessionRepository.save(session);
        return sessionResponse(user, session, rawRefreshToken);
    }

    private AuthSessionResponse sessionResponse(UserAccount user, RefreshSession session, String rawRefreshToken) {
        IssuedAccessToken accessToken = jwtTokenService.issue(user.getId(), session.getId(), user.getEmail());
        return new AuthSessionResponse(
                accessToken.value(),
                "Bearer",
                accessToken.expiresAt(),
                rawRefreshToken,
                session.getExpiresAt(),
                UserResponse.from(user)
        );
    }

    private UserAccount findUserByEmail(String email) {
        return userAccountRepository.findByEmail(normalizeEmail(email))
                .orElseThrow(() -> AuthDomainException.badRequest(
                        "VERIFICATION_CHALLENGE_NOT_FOUND",
                        "No pending verification was found for this email address."
                ));
    }

    private void revokeFamily(String familyId, Instant now) {
        refreshSessionRepository.findByFamilyIdAndRevokedAtIsNull(familyId)
                .forEach(session -> session.revoke(now));
    }

    private AuthDomainException invalidCredentials() {
        return AuthDomainException.unauthorized("INVALID_CREDENTIALS", "Email or password is incorrect.");
    }

    private AuthDomainException invalidRefreshToken() {
        return AuthDomainException.unauthorized("INVALID_REFRESH_TOKEN", "Refresh token is invalid or expired.");
    }

    private String normalizeEmail(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }

    private String normalizeMobileNumber(String mobileNumber) {
        return mobileNumber.trim().replaceAll("[\\s()-]", "");
    }

    private String normalizeFullName(String fullName) {
        String normalized = fullName.trim().replaceAll("\\s+", " ");
        if (normalized.length() < 2) {
            throw AuthDomainException.badRequest("INVALID_NAME", "Enter your full name.");
        }
        return normalized;
    }
}
