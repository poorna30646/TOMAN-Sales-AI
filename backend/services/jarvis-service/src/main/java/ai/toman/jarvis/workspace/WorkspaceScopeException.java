package ai.toman.jarvis.workspace;

public class WorkspaceScopeException extends RuntimeException {

    private final int status;

    public WorkspaceScopeException(int status, String message) {
        super(message);
        this.status = status;
    }

    public int status() {
        return status;
    }
}
