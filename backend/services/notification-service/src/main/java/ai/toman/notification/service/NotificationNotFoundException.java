package ai.toman.notification.service;

public class NotificationNotFoundException extends RuntimeException {

    public NotificationNotFoundException() {
        super("The requested notification was not found in this owner workspace.");
    }
}
