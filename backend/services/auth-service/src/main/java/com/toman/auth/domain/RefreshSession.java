package com.toman.auth.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.ForeignKey;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

@Entity
@Table(name = "refresh_sessions", indexes = {
        @Index(name = "idx_refresh_sessions_user", columnList = "user_id"),
        @Index(name = "idx_refresh_sessions_family", columnList = "family_id"),
        @Index(name = "idx_refresh_sessions_token_hash", columnList = "token_hash", unique = true)
})
public class RefreshSession {

    @Id
    @Column(name = "id", nullable = false, updatable = false, length = 36)
    private String id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false, foreignKey = @ForeignKey(name = "fk_refresh_sessions_user"))
    private UserAccount user;

    @Column(name = "family_id", nullable = false, length = 36)
    private String familyId;

    /** SHA-256 digest of the opaque refresh token; raw tokens are never stored. */
    @Column(name = "token_hash", nullable = false, unique = true, length = 64)
    private String tokenHash;

    @Column(name = "issued_at", nullable = false, updatable = false)
    private Instant issuedAt;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(name = "revoked_at")
    private Instant revokedAt;

    @Column(name = "replaced_by_session_id", length = 36)
    private String replacedBySessionId;

    @Column(name = "user_agent", length = 512)
    private String userAgent;

    @Column(name = "ip_address", length = 64)
    private String ipAddress;

    protected RefreshSession() {
        // Required by JPA.
    }

    private RefreshSession(
            UserAccount user,
            String familyId,
            String tokenHash,
            Instant expiresAt,
            String userAgent,
            String ipAddress
    ) {
        this.user = Objects.requireNonNull(user);
        this.familyId = Objects.requireNonNull(familyId);
        this.tokenHash = Objects.requireNonNull(tokenHash);
        this.expiresAt = Objects.requireNonNull(expiresAt);
        this.userAgent = userAgent;
        this.ipAddress = ipAddress;
    }

    public static RefreshSession newFamily(
            UserAccount user,
            String tokenHash,
            Instant expiresAt,
            String userAgent,
            String ipAddress
    ) {
        return new RefreshSession(user, UUID.randomUUID().toString(), tokenHash, expiresAt, userAgent, ipAddress);
    }

    public static RefreshSession rotate(
            UserAccount user,
            String familyId,
            String tokenHash,
            Instant expiresAt,
            String userAgent,
            String ipAddress
    ) {
        return new RefreshSession(user, familyId, tokenHash, expiresAt, userAgent, ipAddress);
    }

    public boolean isActiveAt(Instant now) {
        return revokedAt == null && expiresAt.isAfter(now);
    }

    public void revoke(Instant now) {
        if (revokedAt == null) {
            revokedAt = now;
        }
    }

    public void replaceWith(String replacementSessionId, Instant now) {
        this.replacedBySessionId = replacementSessionId;
        revoke(now);
    }

    @PrePersist
    void initializePersistenceFields() {
        Instant now = Instant.now();
        if (id == null) {
            id = UUID.randomUUID().toString();
        }
        if (issuedAt == null) {
            issuedAt = now;
        }
    }

    public String getId() {
        return id;
    }

    public UserAccount getUser() {
        return user;
    }

    public String getFamilyId() {
        return familyId;
    }

    public Instant getExpiresAt() {
        return expiresAt;
    }

    public Instant getRevokedAt() {
        return revokedAt;
    }
}
