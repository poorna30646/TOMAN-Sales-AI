package com.toman.auth.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "email_verification_challenges", indexes = {
        @Index(name = "idx_email_verification_user_created", columnList = "user_id,created_at")
})
public class EmailVerificationChallenge {

    @Id
    @Column(name = "id", nullable = false, updatable = false, length = 36)
    private String id;

    @Column(name = "user_id", nullable = false, length = 36)
    private String userId;

    @Column(name = "code_hash", nullable = false, length = 100)
    private String codeHash;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(name = "attempt_count", nullable = false)
    private int attemptCount;

    @Column(name = "max_attempts", nullable = false)
    private int maxAttempts;

    @Column(name = "consumed_at")
    private Instant consumedAt;

    @Column(name = "invalidated_at")
    private Instant invalidatedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected EmailVerificationChallenge() {
        // Required by JPA.
    }

    private EmailVerificationChallenge(
            String userId,
            String codeHash,
            Instant expiresAt,
            int maxAttempts
    ) {
        this.userId = userId;
        this.codeHash = codeHash;
        this.expiresAt = expiresAt;
        this.maxAttempts = maxAttempts;
    }

    public static EmailVerificationChallenge create(
            String userId,
            String codeHash,
            Instant expiresAt,
            int maxAttempts
    ) {
        return new EmailVerificationChallenge(userId, codeHash, expiresAt, maxAttempts);
    }

    public boolean canAttemptAt(Instant now) {
        return consumedAt == null
                && invalidatedAt == null
                && expiresAt.isAfter(now)
                && attemptCount < maxAttempts;
    }

    public void registerFailedAttempt(Instant now) {
        attemptCount++;
        if (attemptCount >= maxAttempts) {
            invalidatedAt = now;
        }
    }

    public void consume(Instant now) {
        consumedAt = now;
    }

    public void invalidate(Instant now) {
        if (consumedAt == null) {
            invalidatedAt = now;
        }
    }

    @PrePersist
    void initializePersistenceFields() {
        if (id == null) {
            id = UUID.randomUUID().toString();
        }
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }

    public String getId() {
        return id;
    }

    public String getUserId() {
        return userId;
    }

    public String getCodeHash() {
        return codeHash;
    }

    public Instant getExpiresAt() {
        return expiresAt;
    }

    public int getAttemptCount() {
        return attemptCount;
    }
}
