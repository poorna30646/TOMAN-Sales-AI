package com.toman.auth.api;

import com.toman.auth.service.AuthDomainException;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

@RestControllerAdvice
public class ApiExceptionHandler {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ApiError> handleValidation(MethodArgumentNotValidException exception) {
        Map<String, String> fieldErrors = new LinkedHashMap<>();
        for (FieldError error : exception.getBindingResult().getFieldErrors()) {
            fieldErrors.putIfAbsent(error.getField(), error.getDefaultMessage());
        }
        return error(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", "One or more fields are invalid.", fieldErrors);
    }

    @ExceptionHandler(AuthDomainException.class)
    ResponseEntity<ApiError> handleDomain(AuthDomainException exception) {
        return error(exception.status(), exception.code(), exception.getMessage(), Map.of());
    }

    @ExceptionHandler(Exception.class)
    ResponseEntity<ApiError> handleUnexpected(Exception exception, HttpServletRequest request) {
        return error(HttpStatus.INTERNAL_SERVER_ERROR, "INTERNAL_ERROR", "An unexpected error occurred.", Map.of());
    }

    private ResponseEntity<ApiError> error(
            HttpStatus status,
            String code,
            String message,
            Map<String, String> fieldErrors
    ) {
        return ResponseEntity.status(status).body(new ApiError(code, message, Instant.now(), fieldErrors));
    }
}
