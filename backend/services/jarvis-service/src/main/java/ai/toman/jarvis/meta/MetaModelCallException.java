package ai.toman.jarvis.meta;

public class MetaModelCallException extends RuntimeException {

    private final String code;

    public MetaModelCallException(String code, String message) {
        super(message);
        this.code = code;
    }

    public MetaModelCallException(String code, String message, Throwable cause) {
        super(message, cause);
        this.code = code;
    }

    public String getCode() {
        return code;
    }
}
