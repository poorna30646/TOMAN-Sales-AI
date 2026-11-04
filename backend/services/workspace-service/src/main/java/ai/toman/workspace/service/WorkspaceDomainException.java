package ai.toman.workspace.service;

import org.springframework.http.HttpStatus;

public class WorkspaceDomainException extends RuntimeException {

    private final HttpStatus status;
    private final String code;

    private WorkspaceDomainException(HttpStatus status, String code, String message) {
        super(message);
        this.status = status;
        this.code = code;
    }

    public static WorkspaceDomainException conflict(String code, String message) {
        return new WorkspaceDomainException(HttpStatus.CONFLICT, code, message);
    }

    public static WorkspaceDomainException notFound(String code, String message) {
        return new WorkspaceDomainException(HttpStatus.NOT_FOUND, code, message);
    }

    public static WorkspaceDomainException badRequest(String code, String message) {
        return new WorkspaceDomainException(HttpStatus.BAD_REQUEST, code, message);
    }

    public HttpStatus status() { return status; }
    public String code() { return code; }
}
