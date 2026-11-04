package ai.toman.jarvis.api;

/** Does not expose API keys or other credentials. */
public record MetaModelStatusResponse(
        boolean configured,
        String provider,
        String model) {
}
