# Local development

## Services and ports

| Component | Address |
| --- | --- |
| API gateway | `http://localhost:8080` |
| Auth Service | `http://localhost:8091` |
| Workspace Service | `http://localhost:8082` |
| Jarvis Service | `http://localhost:8085` |
| Ingestion Service | `http://localhost:8086` |
| Notification Service | `http://localhost:8087` |
| Config Service | `http://localhost:8888` |
| Eureka | `http://localhost:8761` |
| MySQL | `localhost:3306` |

## Required local environment

Copy `.env.example` to an untracked `.env`, generate non-empty values for the three trust variables, and load it before every `spring-boot:run` command:

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

`TOMAN_AUTH_JWT_SECRET` is shared only between Auth Service and API Gateway. `TOMAN_GATEWAY_INTERNAL_KEY` is shared only between the gateway and protected downstream services. `NOTIFICATION_INTERNAL_API_KEY` is used only for the Jarvis-to-Notification internal delivery endpoint. None belongs in the mobile app.

The local auth profile can expose a development verification code in the registration response. To enable real email, set `SMTP_ENABLED=true` plus `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, and `SMTP_FROM` in `.env`; set `AUTH_VERIFICATION_EXPOSE_CODE=false`. Do not enable code exposure in any shared environment.

## Database configuration

The local standard for a service database is:

```text
jdbc:mysql://localhost:3306/toman_<service>?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC
```

Services use `toman_app` plus their respective `*_DATABASE_PASSWORD` environment variable. Do not hard-code a database password in `application.yml`.

## Meta configuration

Only `jarvis-service` receives these server-side values:

```text
META_AI_BASE_URL=https://api.meta.ai/v1
META_AI_API_KEY=
META_AI_MODEL=muse-spark-1.3
```

If `META_AI_API_KEY` is empty, the service starts but blocks planning safely. It does not fall back to another provider and does not create sample plans.

## Android connectivity

The React Native app defaults to `http://10.0.2.2:8080`, which maps an Android emulator to this computer's gateway. For a physical device, configure the app with the computer's LAN address, for example `http://192.168.1.20:8080`. Do not expose individual service ports to the device.
