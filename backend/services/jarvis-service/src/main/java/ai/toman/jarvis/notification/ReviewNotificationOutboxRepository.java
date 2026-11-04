package ai.toman.jarvis.notification;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ReviewNotificationOutboxRepository extends JpaRepository<ReviewNotificationOutboxEvent, UUID> {
    List<ReviewNotificationOutboxEvent> findTop25ByDeliveredAtIsNullOrderByCreatedAtAsc();
}
