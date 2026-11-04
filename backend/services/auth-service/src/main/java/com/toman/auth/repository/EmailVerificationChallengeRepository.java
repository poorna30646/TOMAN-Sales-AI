package com.toman.auth.repository;

import com.toman.auth.domain.EmailVerificationChallenge;
import java.time.Instant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface EmailVerificationChallengeRepository extends JpaRepository<EmailVerificationChallenge, String> {

    Optional<EmailVerificationChallenge> findFirstByUserIdAndConsumedAtIsNullAndInvalidatedAtIsNullOrderByCreatedAtDesc(String userId);

    List<EmailVerificationChallenge> findByUserIdAndConsumedAtIsNullAndInvalidatedAtIsNull(String userId);

    /**
     * Invalidates previous codes in one database operation before a new code
     * is issued. This avoids stale-row updates when an owner taps resend more
     * than once on MariaDB.
     */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("""
            update EmailVerificationChallenge challenge
            set challenge.invalidatedAt = :invalidatedAt
            where challenge.userId = :userId
              and challenge.consumedAt is null
              and challenge.invalidatedAt is null
            """)
    int invalidateOutstandingForUser(
            @Param("userId") String userId,
            @Param("invalidatedAt") Instant invalidatedAt
    );
}
