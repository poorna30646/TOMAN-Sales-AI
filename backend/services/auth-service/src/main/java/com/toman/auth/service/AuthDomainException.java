package com.toman.auth.service;

import org.springframework.http.HttpStatus;

public class AuthDomainException extends RuntimeException {

    private final HttpStatus status;
    private final String code;

    private AuthDomainException(HttpStatus status, String code, String message) {
        super(message);
        this.status = status;
        this.code = code;
    }

    public static AuthDomainException conflict(String code, String message) {
        return new AuthDomainException(HttpStatus.CONFLICT, code, message);
    }

    public static AuthDomainException badRequest(String code, String message) {
        return new AuthDomainException(HttpStatus.BAD_REQUEST, code, message);
    }

    public static AuthDomainException unauthorized(String code, String message) {
        return new AuthDomainException(HttpStatus.UNAUTHORIZED, code, message);
    }

    public static AuthDomainException forbidden(String code, String message) {
        return new AuthDomainException(HttpStatus.FORBIDDEN, code, message);
    }

    public static AuthDomainException notFound(String code, String message) {
        return new AuthDomainException(HttpStatus.NOT_FOUND, code, message);
    }

    public static AuthDomainException serviceUnavailable(String code, String message) {
        return new AuthDomainException(HttpStatus.SERVICE_UNAVAILABLE, code, message);
    }

    public HttpStatus status() {
        return status;
    }

    public String code() {
        return code;
    }
}
