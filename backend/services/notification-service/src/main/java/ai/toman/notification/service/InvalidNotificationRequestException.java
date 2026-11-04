package ai.toman.notification.service;

public class InvalidNotificationRequestException extends RuntimeException {

    public InvalidNotificationRequestException(String message) {
        super(message);
    }
}
