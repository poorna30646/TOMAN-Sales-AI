# TOMAN Sales AI backend

This is the Spring Boot MVC **microservice backend** for TOMAN Sales AI, separate from the bare React Native app. It is not a monolith: every implemented business capability owns its database, Flyway migrations, API surface, and service boundary.

## Implemented modules

| Module | Port | Responsibility |
| --- | ---: | --- |
| `platform/config-service` | 8888 | Native local configuration server. |
| `platform/discovery-service` | 8761 | Eureka service registry. |
| `platform/api-gateway` | 8080 | The only mobile-facing address; verifies access JWTs and establishes trusted downstream scope. |
| `services/auth-service` | 8091 | Registration, email verification, login, rotating refresh sessions, logout, and current user. |
| `services/workspace-service` | 8082 | One owner workspace, business profile, and notification preferences. |
| `services/jarvis-service` | 8085 | Meta-only Jarvis task planning plus durable review-notification outbox. |
| `services/ingestion-service` | 8086 | Private PDF/XLS/XLSX upload and document metadata. |
| `services/notification-service` | 8087 | Persistent in-app reviews, permissions, completed-task, and new-lead notifications. |
| `platform/common-contracts` | — | Small wire contracts only; never a shared business model. |

`workflow-service` and `integration-service` remain intentionally reserved for the next phase. Social OAuth, publishing, advertising, email delivery, telephony, and approval execution are not simulated as live backend actions.

## Local quick start

Install Java 21, Maven 3.9+, Docker Engine, and the Docker Compose plugin. Then create a local environment file:

```bash
cp .env.example .env
```

Generate three distinct local secrets and put their values in `.env`:

```bash
openssl rand -base64 48
```

Use one generated value for `TOMAN_AUTH_JWT_SECRET`, one for `TOMAN_GATEWAY_INTERNAL_KEY`, and one for `NOTIFICATION_INTERNAL_API_KEY`. The auth JWT value must be Base64 for at least 32 bytes.

Load the environment and map the shared local MySQL password to each service before launching Java processes:

```bash
set -a
. ./.env
set +a

export AUTH_DATABASE_PASSWORD="$MYSQL_APP_PASSWORD"
export WORKSPACE_DATABASE_PASSWORD="$MYSQL_APP_PASSWORD"
export INGESTION_DATABASE_PASSWORD="$MYSQL_APP_PASSWORD"
export JARVIS_DATABASE_PASSWORD="$MYSQL_APP_PASSWORD"
export NOTIFICATION_DATABASE_PASSWORD="$MYSQL_APP_PASSWORD"
export EUREKA_ENABLED=true
```

Start MySQL and wait for its health check:

```bash
docker compose --env-file .env up -d mysql
docker compose --env-file .env ps
```

Verify the source before starting services:

```bash
mvn test
```

Start each service in its own terminal, after loading the same environment in that terminal. Start in this order so service discovery and routes are available:

```bash
mvn -pl platform/discovery-service spring-boot:run
mvn -pl platform/config-service spring-boot:run
mvn -pl services/auth-service spring-boot:run
mvn -pl services/workspace-service spring-boot:run
mvn -pl services/ingestion-service spring-boot:run
mvn -pl services/notification-service spring-boot:run
mvn -pl services/jarvis-service spring-boot:run
mvn -pl platform/api-gateway spring-boot:run
```

Check each process at `/actuator/health`, then point the Android emulator at the default gateway address `http://10.0.2.2:8080`. A physical Android device must use the computer's reachable LAN address instead.

The `local` auth profile intentionally returns a development verification code in the registration response; this lets local mobile onboarding work until SMTP is configured. It must not be enabled for a shared or production environment.

## Security and tenant boundaries

- The mobile app calls only the gateway, never MySQL or a microservice port.
- The gateway validates a short-lived JWT, removes any client-supplied user/workspace/trust headers, resolves the owner workspace internally, and signs downstream requests with `TOMAN_GATEWAY_INTERNAL_KEY`.
- Workspace, ingestion, Jarvis, and notification services reject direct requests that do not carry that server-only key. The mobile app cannot choose another workspace by changing a header.
- Access tokens are short-lived; only a rotating refresh token is stored in platform secure storage. A never-expiring JWT is not used.
- Provider credentials, Meta keys, OAuth tokens, and the gateway trust keys must never enter source control, API responses, logs, or the React Native bundle.
- No outbound post, message, call, ad spend, or provider action is implemented without the future workflow/integration approval boundary.

## Data ownership

Docker Compose creates local databases named `toman_auth`, `toman_workspace`, `toman_ingestion`, `toman_jarvis`, `toman_notification`, `toman_workflow`, and `toman_integration`. Each service accesses only its own database. Cross-service work uses APIs or durable outbox delivery, never direct database reads.

The Ingestion Service accepts only PDF, XLS, and XLSX uploads, validates the declared file type and file signature/package, stores bytes outside MySQL in private storage, and records only owned metadata in `toman_ingestion`. Antivirus scanning and extraction are follow-up services, so the current service does not claim to perform them.

## Meta-only Jarvis policy

Jarvis and its agents support only Meta model configuration: `META_AI_BASE_URL`, `META_AI_API_KEY`, and `META_AI_MODEL`. If the Meta key is missing, Jarvis returns a durable `BLOCKED_CONFIGURATION` task rather than a fake plan. When a real Meta plan needs owner review, Jarvis writes an outbox event and the notification service creates the real in-app notification.

Real users always begin with empty workspace state until they add their own business data. Demo data exists only in the explicit mobile demo flow and is never inserted by these services.

See [docs/architecture.md](docs/architecture.md) and [docs/local-development.md](docs/local-development.md) for the detailed boundaries and local configuration.
