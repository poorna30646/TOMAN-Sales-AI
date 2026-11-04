# TOMAN Sales AI - Project Documentation

TOMAN Sales AI is an owner-controlled AI sales workspace for small and growing businesses. Jarvis turns business context, customer data, and sales goals into reviewable plans. Jarvis can analyze, draft, recommend, and coordinate work, but an owner must review before any external action such as sending, calling, publishing, or spending budget.

The project includes a native Android mobile app and a Java/Spring Boot microservice platform. A local interactive demo is included for product recording; it shows sample metrics, leads, campaigns, agent activity, and integrations without contacting a backend or external provider.

## Repository layout

```text
TOMAN-Sales-AI/
  backend/
    platform/
      discovery-service/       Eureka registry
      config-service/          Central configuration
      api-gateway/             Public API entry point and JWT filter
      common-contracts/        Shared contracts
    services/
      auth-service/            Registration, verification, JWT, refresh session
      workspace-service/       Workspace profile and settings
      ingestion-service/       PDF/XLSX intake and metadata
      jarvis-service/          Meta task orchestration and review outbox
      notification-service/    Owner notification inbox
  mobile-app/                  React Native CLI application
  docs/TOMAN_Project_Documentation.md
  TOMAN_Sales_AI_Project_Documentation.pdf
```

## Mobile application

| Area | Technology / implementation |
| --- | --- |
| Runtime | React Native CLI 0.88.1 with React 19.3 |
| Language | TypeScript |
| Platforms | Android now; iOS project is included |
| UI | Native React Native components using TOMAN design tokens |
| Secure token storage | `react-native-keychain` |
| Document upload | `@react-native-documents/picker` |
| Voice output | `react-native-tts` for the local demo |
| Safe layout | `react-native-safe-area-context` |
| Quality tooling | ESLint, TypeScript, Jest |

Bootstrap CSS is appropriate for a future web/desktop React portal. It does not apply to native React Native screens, which use React Native styling.

### Mobile journey

1. Owner registration.
2. Email verification.
3. Business setup.
4. Jarvis introduction.
5. Sales dashboard.
6. Jarvis conversation and task review.
7. Settings, document upload, notifications, channels, and integrations.
8. Offline interactive demo for a recording without backend or provider access.

## Microservice architecture

All mobile requests enter through the API Gateway. The gateway validates JWTs, assigns correlation IDs, and routes requests to the appropriate service. Eureka provides service discovery, while Spring Cloud Config centralizes service configuration. Each business capability owns its own MariaDB/MySQL database schema.

```text
React Native mobile app
        |
        v
API Gateway :8080 - JWT validation, routing, correlation IDs
        |
        +--- Eureka Registry :8761
        +--- Config Service :8888
        +--- Auth Service :8091 -------- toman_auth
        +--- Workspace Service :8082 --- toman_workspace
        +--- Ingestion Service :8086 --- toman_ingestion
        +--- Jarvis Service :8085 ------ toman_jarvis
        +--- Notification Service :8087  toman_notification
```

| Service | Port | Responsibility |
| --- | ---: | --- |
| Discovery Service | 8761 | Eureka service registry |
| Config Service | 8888 | Central local configuration |
| API Gateway | 8080 | Single mobile entry point, JWT validation, routing, correlation IDs |
| Auth Service | 8091 | Registration, verification, login, refresh, logout, current owner |
| Workspace Service | 8082 | Business profile, owner settings, trusted workspace lookup |
| Ingestion Service | 8086 | PDF/XLSX upload validation, storage, metadata, and download |
| Jarvis Service | 8085 | Meta Muse Spark task planning, agent lifecycle, and review outbox |
| Notification Service | 8087 | Owner notifications for reviews, permissions, task completion, and new leads |

The gateway also reserves `/api/v1/reviews`, `/api/v1/approvals`, and `/api/v1/integrations` for future workflow and integration services.

## Public API inventory

The local gateway base URL is `http://127.0.0.1:8080`. For a USB-connected Android device, use `adb reverse tcp:8080 tcp:8080`. Protected endpoints require an `Authorization: Bearer <access-token>` header.

### Auth Service

| Method | Endpoint | Purpose |
| --- | --- | --- |
| POST | `/api/v1/auth/register` | Create an owner account |
| POST | `/api/v1/auth/verify-email` | Confirm the emailed verification code |
| POST | `/api/v1/auth/resend-verification` | Send another verification code |
| POST | `/api/v1/auth/login` | Authenticate an owner |
| POST | `/api/v1/auth/refresh` | Rotate a refresh session and issue a new token pair |
| POST | `/api/v1/auth/logout` | Revoke the current refresh session |
| GET | `/api/v1/auth/me` | Read the authenticated owner |

### Workspace Service

| Method | Endpoint | Purpose |
| --- | --- | --- |
| POST | `/api/v1/workspaces` | Create the business workspace |
| GET | `/api/v1/workspaces/current` | Read the owner workspace |
| GET | `/api/v1/settings` | Read owner settings |
| PUT | `/api/v1/settings` | Update owner settings |
| GET | `/internal/v1/workspaces/current` | Internal trusted workspace lookup |

### Ingestion Service

| Method | Endpoint | Purpose |
| --- | --- | --- |
| POST | `/api/v1/documents` | Upload a PDF/XLSX document |
| GET | `/api/v1/documents` | List uploaded documents |
| GET | `/api/v1/documents/{documentId}` | Read document metadata |
| GET | `/api/v1/documents/{documentId}/download` | Download stored content |

### Jarvis Service

| Method | Endpoint | Purpose |
| --- | --- | --- |
| POST | `/api/v1/jarvis/tasks` | Ask Jarvis to create a planned task |
| GET | `/api/v1/jarvis/tasks` | List the workspace task history |
| POST | `/api/v1/jarvis/tasks/{taskId}/owner-decision` | Approve, reject, or revise a task |
| GET | `/api/v1/jarvis/meta/status` | Check Meta provider configuration status |

### Notification Service

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/v1/notifications` | Read owner notification inbox |
| POST | `/api/v1/notifications/{notificationId}/read` | Mark one notification as read |
| POST | `/api/v1/notifications/read-all` | Mark all notifications as read |
| POST | `/internal/v1/notifications` | Trusted internal notification creation |

## Database architecture

Each service owns its data. No service directly shares another service's database.

| Database | Tables |
| --- | --- |
| `toman_auth` | `user_accounts`, `email_verification_challenges`, `refresh_sessions` |
| `toman_workspace` | `workspaces`, `workspace_settings` |
| `toman_ingestion` | `documents` |
| `toman_jarvis` | `agent_tasks`, `review_notification_outbox` |
| `toman_notification` | `owner_notifications` |

| Table | Purpose and key controls |
| --- | --- |
| `user_accounts` | UUID identity; unique email and mobile number; password hash; verification state; timestamps |
| `email_verification_challenges` | Hashed verification code, expiry time, attempt count, consumed state |
| `refresh_sessions` | Hashed refresh token, token family, expiry, rotation, revocation metadata |
| `workspaces` | Business profile and owner business details |
| `workspace_settings` | Four owner notification switches and workspace preferences |
| `documents` | Workspace scope, filename, content type, category, byte count, SHA hash, storage location, status |
| `agent_tasks` | Workspace scope, prompt, state, Meta model ID, plan JSON, failure detail, lifecycle timestamps |
| `review_notification_outbox` | Unique task, delivery attempts, errors, and notification delivery tracking |
| `owner_notifications` | Event type, title, message, reference, read state, and created timestamp |

## AI and provider APIs

| Provider | Intended role | Current position |
| --- | --- | --- |
| Meta AI Chat Completions / Muse Spark | Jarvis planning and agent orchestration | Jarvis service configuration is implemented |
| ElevenLabs | Premium Jarvis speech | Provider key and voice are validated; backend adapter is a future extension. The local mobile demo uses device TTS |
| SMTP | Email verification codes | Auth Service server environment configuration |
| Meta Graph API / WhatsApp Cloud API | Messaging, publishing, and analytics | Server configuration only; live adapter and webhook are future integration work |
| Facebook and Instagram Graph APIs | OAuth, publishing, insights | Planned secure OAuth integration |
| Google Ads API | Campaign management and reporting | Planned secure OAuth integration |
| YouTube Data API | Video publishing and analytics | Planned secure OAuth integration |

Android permissions cannot replace provider OAuth. External publishing, messaging, advertising, and analytics must happen through server-side OAuth tokens, provider consent, review gates, and audited actions.

## Security and consent

- Passwords and email verification codes are stored as hashes, not plaintext.
- Refresh tokens are hashed, rotated, and stored on the device with native secure storage.
- JWTs are validated at the gateway before protected routes are forwarded.
- Workspace scope is enforced for user-owned data.
- Jarvis cannot automatically send, call, publish, or spend money. The owner must approve actions.
- The review notification outbox provides durable, traceable owner-review notifications.
- Secrets belong in backend `.env` files or a production secret manager only. Never put API keys in the mobile app, APK, screenshots, or Git history.

## Local development

### Start the backend stack

```bash
cd backend
./scripts/start-local-stack.sh
```

### Start the mobile app

```bash
cd mobile-app
npm install
npm start
npm run android -- --device <device-id>
```

For a physical USB Android device, map the local gateway first:

```bash
adb reverse tcp:8080 tcp:8080
```

### Recording demo

Press **Open interactive demo** from the Welcome or Sign in screen. The demo uses local sample data and local voice output; it does not require the backend or any external provider. It is designed for a reliable product walkthrough or video capture.

## GitHub handoff and future work

Before pushing:

- Confirm `backend/.env`, runtime logs, build output, local databases, and provider credentials are ignored.
- Commit only `.env.example` files with variable names, never real values.
- The mobile application retains a nested `.git` directory to preserve its original history. Deliberately migrate or remove it before converting this consolidated folder into one parent Git repository.

Recommended next milestones:

1. Add a workflow/integration service for provider OAuth, token encryption, webhooks, rate limits, and audited actions.
2. Build review/approval workflows around every external side effect.
3. Use object storage for uploads and generated media.
4. Add monitoring, alerting, backups, and a production secret manager.
5. Complete real Meta, WhatsApp, Facebook, Instagram, Google Ads, and YouTube adapters after their app review and OAuth setup.

For the formatted version, see [TOMAN Sales AI Project Documentation](./TOMAN_Sales_AI_Project_Documentation.pdf).
