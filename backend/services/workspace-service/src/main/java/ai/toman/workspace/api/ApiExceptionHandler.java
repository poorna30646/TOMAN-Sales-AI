package ai.toman.workspace.api;

import ai.toman.workspace.service.WorkspaceDomainException;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class ApiExceptionHandler {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ApiError> validation(MethodArgumentNotValidException exception) {
        Map<String, String> fields = new LinkedHashMap<>();
        for (FieldError error : exception.getBindingResult().getFieldErrors()) {
            fields.putIfAbsent(error.getField(), error.getDefaultMessage());
        }
        return error(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", "One or more fields are invalid.", fields);
    }

    @ExceptionHandler(WorkspaceDomainException.class)
    ResponseEntity<ApiError> domain(WorkspaceDomainException exception) {
        return error(exception.status(), exception.code(), exception.getMessage(), Map.of());
    }

    @ExceptionHandler(Exception.class)
    ResponseEntity<ApiError> unexpected(Exception exception) {
        return error(HttpStatus.INTERNAL_SERVER_ERROR, "INTERNAL_ERROR", "An unexpected error occurred.", Map.of());
    }

    private ResponseEntity<ApiError> error(HttpStatus status, String code, String message, Map<String, String> fields) {
        return ResponseEntity.status(status).body(new ApiError(code, message, Instant.now(), fields));
    }
}
