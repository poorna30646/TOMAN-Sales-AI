package ai.toman.notification.repository;

import ai.toman.notification.domain.OwnerNotification;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface OwnerNotificationRepository extends JpaRepository<OwnerNotification, UUID> {

    Page<OwnerNotification> findAllByWorkspaceIdAndOwnerId(UUID workspaceId, UUID ownerId, Pageable pageable);

    Page<OwnerNotification> findAllByWorkspaceIdAndOwnerIdAndReadAtIsNull(
            UUID workspaceId, UUID ownerId, Pageable pageable);

    Optional<OwnerNotification> findByIdAndWorkspaceIdAndOwnerId(UUID id, UUID workspaceId, UUID ownerId);

    long countByWorkspaceIdAndOwnerIdAndReadAtIsNull(UUID workspaceId, UUID ownerId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
            update OwnerNotification notification
               set notification.readAt = :readAt
             where notification.workspaceId = :workspaceId
               and notification.ownerId = :ownerId
               and notification.readAt is null
            """)
    int markAllRead(
            @Param("workspaceId") UUID workspaceId,
            @Param("ownerId") UUID ownerId,
            @Param("readAt") Instant readAt);
}
