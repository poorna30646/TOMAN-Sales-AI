package ai.toman.notification.service;

import ai.toman.notification.api.InternalNotificationRequest;
import ai.toman.notification.api.MarkAllReadResponse;
import ai.toman.notification.api.NotificationPageResponse;
import ai.toman.notification.api.NotificationResponse;
import ai.toman.notification.domain.NotificationType;
import ai.toman.notification.domain.OwnerNotification;
import ai.toman.notification.repository.OwnerNotificationRepository;
import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class NotificationService {

    private static final int TITLE_MAX_LENGTH = 180;
    private static final int MESSAGE_MAX_LENGTH = 1500;
    private static final int REFERENCE_TYPE_MAX_LENGTH = 80;

    private final OwnerNotificationRepository repository;

    public NotificationService(OwnerNotificationRepository repository) {
        this.repository = repository;
    }

    /** Creates an in-app event. This deliberately does not send an OS push notification. */
    @Transactional
    public NotificationResponse create(InternalNotificationRequest request) {
        Objects.requireNonNull(request, "request is required");
        UUID workspaceId = requiredUuid(request.workspaceId(), "workspaceId");
        UUID ownerId = requiredUuid(request.ownerId(), "ownerId");
        NotificationType type = Objects.requireNonNull(request.type(), "type is required");
        String title = requiredText(request.title(), "title", TITLE_MAX_LENGTH);
        String message = requiredText(request.message(), "message", MESSAGE_MAX_LENGTH);
        String referenceType = optionalText(request.referenceType(), "referenceType", REFERENCE_TYPE_MAX_LENGTH);

        if ((referenceType == null) != (request.referenceId() == null)) {
            throw new InvalidNotificationRequestException(
                    "referenceType and referenceId must either both be supplied or both be omitted");
        }

        OwnerNotification notification = OwnerNotification.create(
                workspaceId,
                ownerId,
                type,
                title,
                message,
                referenceType,
                request.referenceId());
        OwnerNotification saved = repository.save(notification);
        return NotificationResponse.from(saved);
    }

    @Transactional(readOnly = true)
    public NotificationPageResponse list(UUID workspaceId, UUID ownerId, int page, int size, boolean unreadOnly) {
        requirePublicScope(workspaceId, ownerId);
        if (page < 0 || size < 1 || size > 100) {
            throw new InvalidNotificationRequestException("page must be non-negative and size must be between 1 and 100");
        }

        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id")));
        Page<OwnerNotification> result = unreadOnly
                ? repository.findAllByWorkspaceIdAndOwnerIdAndReadAtIsNull(workspaceId, ownerId, pageable)
                : repository.findAllByWorkspaceIdAndOwnerId(workspaceId, ownerId, pageable);
        List<NotificationResponse> content = result.getContent().stream().map(NotificationResponse::from).toList();

        return new NotificationPageResponse(
                content,
                result.getNumber(),
                result.getSize(),
                result.getTotalElements(),
                result.getTotalPages(),
                repository.countByWorkspaceIdAndOwnerIdAndReadAtIsNull(workspaceId, ownerId));
    }

    @Transactional
    public NotificationResponse markRead(UUID notificationId, UUID workspaceId, UUID ownerId) {
        requirePublicScope(workspaceId, ownerId);
        if (notificationId == null) {
            throw new InvalidNotificationRequestException("notificationId is required");
        }

        OwnerNotification notification = repository.findByIdAndWorkspaceIdAndOwnerId(notificationId, workspaceId, ownerId)
                // Returning 404 for an out-of-scope ID prevents notification enumeration.
                .orElseThrow(NotificationNotFoundException::new);
        notification.markRead(Instant.now());
        return NotificationResponse.from(notification);
    }

    @Transactional
    public MarkAllReadResponse markAllRead(UUID workspaceId, UUID ownerId) {
        requirePublicScope(workspaceId, ownerId);
        Instant readAt = Instant.now();
        int markedRead = repository.markAllRead(workspaceId, ownerId, readAt);
        return new MarkAllReadResponse(markedRead, readAt);
    }

    private void requirePublicScope(UUID workspaceId, UUID ownerId) {
        requiredUuid(workspaceId, "workspaceId");
        requiredUuid(ownerId, "ownerId");
    }

    private UUID requiredUuid(UUID value, String field) {
        if (value == null) {
            throw new InvalidNotificationRequestException(field + " is required");
        }
        return value;
    }

    private String requiredText(String value, String field, int maximumLength) {
        String normalized = optionalText(value, field, maximumLength);
        if (normalized == null) {
            throw new InvalidNotificationRequestException(field + " is required");
        }
        return normalized;
    }

    private String optionalText(String value, String field, int maximumLength) {
        if (value == null) {
            return null;
        }
        String normalized = value.trim();
        if (normalized.isEmpty()) {
            return null;
        }
        if (normalized.length() > maximumLength) {
            throw new InvalidNotificationRequestException(field + " must not exceed " + maximumLength + " characters");
        }
        return normalized;
    }
}
