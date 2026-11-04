package ai.toman.contracts;

/** Standard headers forwarded between TOMAN services. */
public final class RequestHeaders {

    public static final String CORRELATION_ID = "X-Correlation-Id";
    public static final String WORKSPACE_ID = "X-Workspace-Id";
    /** Injected by the API gateway after it has validated a TOMAN access token. */
    public static final String AUTHENTICATED_USER_ID = "X-TOMAN-User-Id";
    /** Server-to-server marker injected by the gateway; never supplied by mobile clients. */
    public static final String GATEWAY_TRUST_KEY = "X-TOMAN-Gateway-Key";

    private RequestHeaders() {
    }
}
