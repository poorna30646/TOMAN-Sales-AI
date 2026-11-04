package ai.toman.ingestion.api;

import ai.toman.ingestion.service.IngestionException;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.MultipartException;
import org.springframework.web.multipart.support.MissingServletRequestPartException;

@RestControllerAdvice
public class ApiExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(ApiExceptionHandler.class);

    @ExceptionHandler(IngestionException.class)
    ResponseEntity<ApiError> ingestion(IngestionException exception) {
        return error(exception.status(), exception.code(), exception.getMessage(), Map.of());
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    ResponseEntity<ApiError> uploadTooLarge(MaxUploadSizeExceededException exception) {
        return error(
                HttpStatus.PAYLOAD_TOO_LARGE,
                "DOCUMENT_TOO_LARGE",
                "The document exceeds the configured upload size limit.",
                Map.of());
    }

    @ExceptionHandler({MissingServletRequestPartException.class, MultipartException.class})
    ResponseEntity<ApiError> malformedMultipart(Exception exception) {
        return error(
                HttpStatus.BAD_REQUEST,
                "INVALID_MULTIPART_UPLOAD",
                "Provide one valid document in the 'file' multipart field.",
                Map.of());
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    ResponseEntity<ApiError> invalidPathOrHeader(MethodArgumentTypeMismatchException exception) {
        return error(
                HttpStatus.BAD_REQUEST,
                "INVALID_REQUEST_IDENTIFIER",
                "A document, owner, or workspace identifier is invalid.",
                Map.of());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ApiError> invalidRequest(MethodArgumentNotValidException exception) {
        Map<String, String> fields = new LinkedHashMap<>();
        for (FieldError fieldError : exception.getBindingResult().getFieldErrors()) {
            fields.putIfAbsent(fieldError.getField(), fieldError.getDefaultMessage());
        }
        return error(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", "The request is invalid.", fields);
    }

    @ExceptionHandler(Exception.class)
    ResponseEntity<ApiError> unexpected(Exception exception, HttpServletRequest request) {
        // Keep operational detail in server logs only. User-facing responses must
        // not disclose local storage locations or persistence implementation.
        log.error("Unhandled ingestion-service error for {}", request.getRequestURI(), exception);
        return error(
                HttpStatus.INTERNAL_SERVER_ERROR,
                "INGESTION_UNAVAILABLE",
                "The document could not be processed right now. Please try again.",
                Map.of());
    }

    private ResponseEntity<ApiError> error(
            HttpStatus status,
            String code,
            String message,
            Map<String, String> fieldErrors) {
        return ResponseEntity.status(status)
                .body(new ApiError(code, message, Instant.now(), fieldErrors));
    }
}
