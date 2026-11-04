package com.toman.auth.service;

import com.toman.auth.config.AuthProperties;
import com.toman.auth.domain.EmailVerificationChallenge;
import com.toman.auth.domain.UserAccount;
import com.toman.auth.repository.EmailVerificationChallengeRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Instant;

@Service
public class EmailVerificationService {

    private final EmailVerificationChallengeRepository challengeRepository;
    private final PasswordEncoder passwordEncoder;
    private final VerificationEmailSender emailSender;
    private final AuthProperties properties;
    private final SecureRandom secureRandom = new SecureRandom();

    public EmailVerificationService(
            EmailVerificationChallengeRepository challengeRepository,
            PasswordEncoder passwordEncoder,
            VerificationEmailSender emailSender,
            AuthProperties properties
    ) {
        this.challengeRepository = challengeRepository;
        this.passwordEncoder = passwordEncoder;
        this.emailSender = emailSender;
        this.properties = properties;
    }

    @Transactional
    public VerificationIssue issue(UserAccount user) {
        Instant now = Instant.now();
        challengeRepository.invalidateOutstandingForUser(user.getId(), now);

        String code = generateNumericCode(properties.getVerification().getCodeLength());
        Instant expiresAt = now.plus(properties.getVerification().getCodeTtl());
        EmailVerificationChallenge challenge = EmailVerificationChallenge.create(
                user.getId(),
                passwordEncoder.encode(code),
                expiresAt,
                properties.getVerification().getMaxAttempts()
        );
        challengeRepository.save(challenge);
        emailSender.send(new VerificationEmailMessage(user.getEmail(), code, expiresAt));

        return new VerificationIssue(properties.getVerification().isExposeCode() ? code : null, expiresAt);
    }

    @Transactional
    public void verify(UserAccount user, String code) {
        Instant now = Instant.now();
        EmailVerificationChallenge challenge = challengeRepository
                .findFirstByUserIdAndConsumedAtIsNullAndInvalidatedAtIsNullOrderByCreatedAtDesc(user.getId())
                .orElseThrow(() -> AuthDomainException.badRequest(
                        "VERIFICATION_CHALLENGE_NOT_FOUND",
                        "No active verification challenge was found. Request a new code."
                ));

        if (!challenge.canAttemptAt(now)) {
            throw AuthDomainException.badRequest(
                    "VERIFICATION_CHALLENGE_EXPIRED",
                    "This verification code is expired or no longer valid. Request a new code."
            );
        }
        if (!passwordEncoder.matches(code, challenge.getCodeHash())) {
            challenge.registerFailedAttempt(now);
            throw AuthDomainException.badRequest("INVALID_VERIFICATION_CODE", "The verification code is incorrect.");
        }
        challenge.consume(now);
    }

    private String generateNumericCode(int codeLength) {
        int bound = (int) Math.pow(10, codeLength);
        int floor = (int) Math.pow(10, codeLength - 1);
        return String.valueOf(floor + secureRandom.nextInt(bound - floor));
    }
}
