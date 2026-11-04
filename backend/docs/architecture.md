# Backend architecture

```text
React Native mobile app
        |
        | bearer access token only
        v
API Gateway (:8080) ---------------- Config Service (:8888)
        |                                  |
        | verifies JWT, resolves owner      v
        | workspace internally        service configuration
        | adds server-only trust key
        |
        +---- Auth Service (:8091) ----------- toman_auth
        +---- Workspace Service (:8082) ------ toman_workspace
        +---- Jarvis Service (:8085) --------- toman_jarvis -- Meta only
        +---- Ingestion Service (:8086) ------ toman_ingestion + private files
        +---- Notification Service (:8087) --- toman_notification
        |
        +---- Workflow Service (reserved) ---- toman_workflow
        +---- Integration Service (reserved) - toman_integration

All implemented services register with Discovery Service (Eureka, :8761).
```

## Request and tenant boundary

1. The mobile app calls only the API Gateway with an access JWT. It never sends `X-TOMAN-User-Id`, `X-Workspace-Id`, or the gateway trust key as an authority claim.
2. The gateway validates issuer, signature, expiry, subject, and session claim. It strips those client-supplied headers and replaces the authenticated user ID itself.
3. For document, Jarvis, and notification routes, the gateway calls Workspace Service's protected internal resolver to obtain the owner's real workspace ID. A mobile-provided workspace header is never trusted.
4. The gateway adds a server-only `X-TOMAN-Gateway-Key`. Workspace, Ingestion, Jarvis, and Notification reject direct requests without its matching value.
5. The Jarvis review outbox calls the Notification Service internal endpoint with a separate internal key. No public client can create a notification as another service.

This is a local MVP trust boundary. Deployment should replace static service-to-service keys with managed workload identity and mTLS without changing the mobile contract.

## Service ownership

| Service | Owns now | Does not own |
| --- | --- | --- |
| Auth | owner identity, password hashes, email verification state, refresh-token families | business profiles or provider tokens |
| Workspace | one owner workspace, business settings, notification preferences | user credentials, uploaded file bytes |
| Ingestion | PDF/XLS/XLSX validation, private file storage, document metadata | leads or CRM data extraction |
| Jarvis | Meta-only task intent, plans, owner decision state, review outbox | publishing, provider OAuth, or campaign execution |
| Notification | persistent in-app owner notifications | OS push delivery, campaign logic, or provider credentials |

Every service owns its Flyway migrations and MySQL database. `common-contracts` may contain narrow transport envelopes and header names, but not a shared domain or persistence model.

## Current vertical slice

1. Register an owner, verify email, and issue a short-lived access token plus rotating refresh session.
2. Create the owner's workspace and persist business/notification settings.
3. Upload only the owner's PDF/XLS/XLSX files to private storage; a real workspace has no seeded documents or leads.
4. Ask Jarvis for a Meta-backed plan. Missing Meta configuration yields `BLOCKED_CONFIGURATION`, not artificial output.
5. A Meta plan awaiting owner review creates a durable outbox event and a real notification feed item.

## Deliberately deferred boundaries

Workflow approvals, social/advertising OAuth, posting, WhatsApp/email delivery, calling, video/image generation, CRM extraction, analytics, and device push are future services/integrations. Jarvis may propose work, but it cannot send, post, call, spend, or publish in this vertical slice.
