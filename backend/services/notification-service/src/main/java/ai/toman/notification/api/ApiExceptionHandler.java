package ai.toman.notification.api;

import ai.toman.notification.service.InternalRequestForbiddenException;
import ai.toman.notification.service.InvalidNotificationRequestException;
import ai.toman.notification.service.NotificationNotFoundException;
import jakarta.validation.ConstraintViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingRequestHeaderException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

@RestControllerAdvice
public class ApiExceptionHandler {

    @ExceptionHandler(NotificationNotFoundException.class)
    ProblemDetail notFound(NotificationNotFoundException exception) {
        return problem(HttpStatus.NOT_FOUND, "Notification not found", exception.getMessage());
    }

    @ExceptionHandler(InternalRequestForbiddenException.class)
    ProblemDetail forbidden(InternalRequestForbiddenException exception) {
        return problem(HttpStatus.FORBIDDEN, "Internal request forbidden", exception.getMessage());
    }

    @ExceptionHandler({
            InvalidNotificationRequestException.class,
            ConstraintViolationException.class,
            MethodArgumentNotValidException.class,
            MethodArgumentTypeMismatchException.class,
            MissingRequestHeaderException.class,
            HttpMessageNotReadableException.class
    })
    ProblemDetail invalidRequest(Exception exception) {
        return problem(HttpStatus.BAD_REQUEST, "Invalid notification request", "Check the request fields and identity headers.");
    }

    private ProblemDetail problem(HttpStatus status, String title, String detail) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(status, detail);
        problem.setTitle(title);
        return problem;
    }
}
