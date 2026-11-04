package com.toman.auth.repository;

import com.toman.auth.domain.RefreshSession;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface RefreshSessionRepository extends JpaRepository<RefreshSession, String> {

    @EntityGraph(attributePaths = "user")
    Optional<RefreshSession> findByTokenHash(String tokenHash);

    @EntityGraph(attributePaths = "user")
    Optional<RefreshSession> findByIdAndRevokedAtIsNullAndExpiresAtAfter(String id, Instant now);

    List<RefreshSession> findByFamilyIdAndRevokedAtIsNull(String familyId);
}
