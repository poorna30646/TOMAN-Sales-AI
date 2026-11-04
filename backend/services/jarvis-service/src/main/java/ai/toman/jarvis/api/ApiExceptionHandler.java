package ai.toman.jarvis.api;

import ai.toman.jarvis.workspace.WorkspaceScopeException;
import java.util.NoSuchElementException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.bind.MissingRequestHeaderException;

@RestControllerAdvice
public class ApiExceptionHandler {

    @ExceptionHandler(NoSuchElementException.class)
    ProblemDetail notFound(NoSuchElementException exception) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, exception.getMessage());
        problem.setTitle("Resource not found");
        return problem;
    }

    @ExceptionHandler(IllegalStateException.class)
    ProblemDetail invalidState(IllegalStateException exception) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, exception.getMessage());
        problem.setTitle("Invalid task state");
        return problem;
    }

    @ExceptionHandler(MissingRequestHeaderException.class)
    ProblemDetail missingTrustedScope(MissingRequestHeaderException exception) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(
                HttpStatus.SERVICE_UNAVAILABLE,
                "TOMAN could not establish your secure workspace scope. Please try again in a moment.");
        problem.setTitle("Workspace scope unavailable");
        return problem;
    }

    @ExceptionHandler(WorkspaceScopeException.class)
    ProblemDetail workspaceScope(WorkspaceScopeException exception) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(
                HttpStatus.valueOf(exception.status()),
                exception.getMessage());
        problem.setTitle("Workspace unavailable");
        return problem;
    }
}
