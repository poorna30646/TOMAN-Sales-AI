package ai.toman.contracts;

/** A validation issue that can be displayed safely by a client. */
public record FieldViolation(String field, String message) {
}
