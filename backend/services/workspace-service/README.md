# TOMAN Workspace Service

This service owns a business owner's workspace profile and notification preferences. It is deliberately separate from authentication: auth owns identity and sessions; this service owns the business context after onboarding.

## Public API

The API gateway validates the access token and forwards `X-TOMAN-User-Id`.

- `POST /api/v1/workspaces` — create the owner's first workspace after business setup.
- `GET /api/v1/workspaces/current` — return the signed-in owner's workspace.
- `GET /api/v1/settings` — return business profile and notification preferences.
- `PUT /api/v1/settings` — update those settings.

There are no pre-created businesses, leads, campaigns, or sample settings. Default notification toggles are created only alongside a real owner's first workspace.

## Local configuration

`WORKSPACE_DATABASE_URL`, `WORKSPACE_DATABASE_USERNAME`, and `WORKSPACE_DATABASE_PASSWORD` point to the local MySQL `toman_workspace` database. Run with `mvn spring-boot:run` after MySQL is available.
