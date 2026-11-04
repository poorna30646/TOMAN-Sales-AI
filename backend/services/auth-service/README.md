# TOMAN Auth Service

The Auth Service owns only identity and session data. It contains no demo customers, campaign data, leads, or business data.

## What it provides

- Owner registration using name, email, mobile number, and password
- Email-verification challenge with a six-digit code
- Short-lived HMAC JWT access tokens (15 minutes by default)
- Opaque refresh tokens stored only as SHA-256 hashes and rotated on every refresh
- Session-family revocation on logout and refresh-token replay detection
- `GET /api/v1/auth/me` for the signed-in owner

The user experience can remain signed in until logout, but the access JWT is deliberately **not** permanent. The mobile client must refresh it before expiry and securely retain only the refresh token.

## Local MySQL run

From the backend root, copy `.env.example` to `.env`, choose a local-only `MYSQL_APP_PASSWORD`, and start the MySQL service. The backend initialization script creates the service-owned `toman_auth` database and the `toman_app` user. Export the same password for the application; it is deliberately not hardcoded in source:

```bash
export AUTH_DATABASE_PASSWORD='your-local-mysql-app-password'
```

Then run the service:

```bash
cd services/auth-service
mvn spring-boot:run
```

The default `local` profile applies Flyway migration `V1__create_auth_schema.sql` and exposes the generated verification code **only in the API response** for local onboarding. To send a real message, set `SMTP_ENABLED=true` and supply the server-only `SMTP_*` variables in `.env`; this activates the included SMTP sender. Set `AUTH_VERIFICATION_EXPOSE_CODE=false` whenever SMTP delivery is enabled. If SMTP is disabled outside local/test, the service fails closed rather than claiming delivery succeeded.

## API contract

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/v1/auth/register` | Creates an unverified owner account and verification challenge. |
| `POST` | `/api/v1/auth/verify-email` | Verifies the code and returns an authenticated session. |
| `POST` | `/api/v1/auth/resend-verification` | Replaces a pending challenge. |
| `POST` | `/api/v1/auth/login` | Starts a new session after email verification. |
| `POST` | `/api/v1/auth/refresh` | Rotates an opaque refresh token and returns a new session pair. |
| `POST` | `/api/v1/auth/logout` | Revokes the active refresh-token family. Requires Bearer access token. |
| `GET` | `/api/v1/auth/me` | Returns the current owner. Requires Bearer access token. |

## Parent reactor integration

When the backend root Maven reactor is added, include this module exactly as:

```xml
<module>services/auth-service</module>
```

This service inherits the root Spring Boot/Cloud dependency management and can still be built with `mvn test` from this directory.
