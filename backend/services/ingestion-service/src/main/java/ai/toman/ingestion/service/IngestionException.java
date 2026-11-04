package ai.toman.ingestion.service;

import org.springframework.http.HttpStatus;

/** Expected input and storage failures safe to return to an API caller. */
public class IngestionException extends RuntimeException {

    private final HttpStatus status;
    private final String code;

    public IngestionException(HttpStatus status, String code, String message) {
        super(message);
        this.status = status;
        this.code = code;
    }

    public IngestionException(HttpStatus status, String code, String message, Throwable cause) {
        super(message, cause);
        this.status = status;
        this.code = code;
    }

    public HttpStatus status() {
        return status;
    }

    public String code() {
        return code;
    }
}
