package ai.toman.notification.service;

public class InternalRequestForbiddenException extends RuntimeException {

    public InternalRequestForbiddenException() {
        super("A valid internal service credential is required.");
    }
}
