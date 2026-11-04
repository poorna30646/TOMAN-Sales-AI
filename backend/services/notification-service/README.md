# TOMAN Notification Service

This service stores the owner-visible notification center in its own MySQL database (`toman_notification`). It has no seed data and it does not claim to send operating-system push notifications.

Public endpoints are owner/workspace-scoped through the trusted gateway headers `X-TOMAN-User-Id` and `X-TOMAN-Workspace-Id`:

- `GET /api/v1/notifications?page=0&size=25&unreadOnly=false`
- `POST /api/v1/notifications/{notificationId}/read`
- `POST /api/v1/notifications/read-all`

Trusted TOMAN services create events through `POST /internal/v1/notifications`. Set `NOTIFICATION_INTERNAL_API_KEY` to a high-entropy shared service credential before using that internal route. The mobile app must never receive this secret.
