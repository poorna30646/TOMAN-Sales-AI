package ai.toman.jarvis.notification;

public class NotificationDeliveryException extends RuntimeException {
    public NotificationDeliveryException(String message, Throwable cause) {
        super(message, cause);
    }
}
