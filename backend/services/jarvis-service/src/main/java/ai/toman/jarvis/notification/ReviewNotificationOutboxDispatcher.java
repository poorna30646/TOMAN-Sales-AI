package ai.toman.jarvis.notification;

import java.util.List;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class ReviewNotificationOutboxDispatcher {

    private final ReviewNotificationOutboxRepository events;
    private final NotificationServiceClient notifications;

    public ReviewNotificationOutboxDispatcher(
            ReviewNotificationOutboxRepository events,
            NotificationServiceClient notifications) {
        this.events = events;
        this.notifications = notifications;
    }

    @Scheduled(
            fixedDelayString = "${toman.notification-delivery.retry-delay:PT15S}",
            initialDelayString = "${toman.notification-delivery.initial-delay:PT5S}")
    @Transactional
    public void deliverPending() {
        if (!notifications.configured()) {
            return;
        }
        List<ReviewNotificationOutboxEvent> pending = events.findTop25ByDeliveredAtIsNullOrderByCreatedAtAsc();
        for (ReviewNotificationOutboxEvent event : pending) {
            try {
                notifications.sendReviewRequired(event);
                event.delivered();
            } catch (NotificationDeliveryException exception) {
                event.failed(exception.getMessage());
            }
        }
    }
}
