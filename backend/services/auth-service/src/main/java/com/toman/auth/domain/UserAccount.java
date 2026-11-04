package com.toman.auth.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

@Entity
@Table(name = "user_accounts")
public class UserAccount {

    @Id
    @Column(name = "id", nullable = false, updatable = false, length = 36)
    private String id;

    @Column(name = "full_name", nullable = false, length = 120)
    private String fullName;

    /** Always lower-case and trimmed before persistence. */
    @Column(name = "email", nullable = false, unique = true, length = 254)
    private String email;

    @Column(name = "mobile_number", nullable = false, unique = true, length = 20)
    private String mobileNumber;

    @Column(name = "password_hash", nullable = false, length = 100)
    private String passwordHash;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 32)
    private AccountStatus status;

    @Column(name = "email_verified_at")
    private Instant emailVerifiedAt;

    @Column(name = "last_login_at")
    private Instant lastLoginAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Version
    @Column(name = "version", nullable = false)
    private long version;

    protected UserAccount() {
        // Required by JPA.
    }

    private UserAccount(String fullName, String email, String mobileNumber, String passwordHash) {
        this.fullName = Objects.requireNonNull(fullName);
        this.email = Objects.requireNonNull(email);
        this.mobileNumber = Objects.requireNonNull(mobileNumber);
        this.passwordHash = Objects.requireNonNull(passwordHash);
        this.status = AccountStatus.PENDING_VERIFICATION;
    }

    public static UserAccount pendingVerification(
            String fullName,
            String normalizedEmail,
            String normalizedMobileNumber,
            String passwordHash
    ) {
        return new UserAccount(fullName, normalizedEmail, normalizedMobileNumber, passwordHash);
    }

    public void markEmailVerified(Instant now) {
        this.emailVerifiedAt = now;
        this.status = AccountStatus.ACTIVE;
    }

    public void markLoggedIn(Instant now) {
        this.lastLoginAt = now;
    }

    public boolean isActive() {
        return status == AccountStatus.ACTIVE && emailVerifiedAt != null;
    }

    @PrePersist
    void initializePersistenceFields() {
        Instant now = Instant.now();
        if (id == null) {
            id = UUID.randomUUID().toString();
        }
        if (createdAt == null) {
            createdAt = now;
        }
        updatedAt = now;
    }

    @PreUpdate
    void updateTimestamp() {
        updatedAt = Instant.now();
    }

    public String getId() {
        return id;
    }

    public String getFullName() {
        return fullName;
    }

    public String getEmail() {
        return email;
    }

    public String getMobileNumber() {
        return mobileNumber;
    }

    public String getPasswordHash() {
        return passwordHash;
    }

    public AccountStatus getStatus() {
        return status;
    }

    public Instant getEmailVerifiedAt() {
        return emailVerifiedAt;
    }

    public Instant getLastLoginAt() {
        return lastLoginAt;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
