package ai.toman.jarvis.notification;

import ai.toman.jarvis.domain.AgentTask;
import org.springframework.stereotype.Component;

@Component
public class ReviewNotificationOutbox {

    private final ReviewNotificationOutboxRepository events;

    public ReviewNotificationOutbox(ReviewNotificationOutboxRepository events) {
        this.events = events;
    }

    public void enqueue(AgentTask task) {
        events.save(ReviewNotificationOutboxEvent.forTask(task));
    }
}
