package ai.toman.notification.api;

import ai.toman.notification.service.InternalRequestAuthorizer;
import ai.toman.notification.service.NotificationService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * The API gateway must validate the access token, remove client supplied
 * identity headers, and inject the owner/workspace headers before forwarding
 * these public routes. This service never accepts public identity in a body.
 */
@RestController
@Validated
@RequestMapping
public class NotificationController {

    private final NotificationService notifications;
    private final InternalRequestAuthorizer internalRequests;

    public NotificationController(NotificationService notifications, InternalRequestAuthorizer internalRequests) {
        this.notifications = notifications;
        this.internalRequests = internalRequests;
    }

    @GetMapping("/api/v1/notifications")
    public NotificationPageResponse list(
            @RequestHeader("X-TOMAN-User-Id") UUID ownerId,
            @RequestHeader("X-TOMAN-Workspace-Id") UUID workspaceId,
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "25") @Min(1) @Max(100) int size,
            @RequestParam(defaultValue = "false") boolean unreadOnly) {
        return notifications.list(workspaceId, ownerId, page, size, unreadOnly);
    }

    @PostMapping("/api/v1/notifications/{notificationId}/read")
    public NotificationResponse markRead(
            @PathVariable UUID notificationId,
            @RequestHeader("X-TOMAN-User-Id") UUID ownerId,
            @RequestHeader("X-TOMAN-Workspace-Id") UUID workspaceId) {
        return notifications.markRead(notificationId, workspaceId, ownerId);
    }

    @PostMapping("/api/v1/notifications/read-all")
    public MarkAllReadResponse markAllRead(
            @RequestHeader("X-TOMAN-User-Id") UUID ownerId,
            @RequestHeader("X-TOMAN-Workspace-Id") UUID workspaceId) {
        return notifications.markAllRead(workspaceId, ownerId);
    }

    @PostMapping("/internal/v1/notifications")
    @ResponseStatus(HttpStatus.CREATED)
    public NotificationResponse createInternal(
            @RequestHeader(value = "X-TOMAN-Internal-Key", required = false) String internalApiKey,
            @Valid @RequestBody InternalNotificationRequest request) {
        internalRequests.assertAuthorized(internalApiKey);
        return notifications.create(request);
    }
}
