# Repository and Delivery Plan

## 1. Proposed monorepo structure

```text
TOMAN-Sales-AI/
├── README.md
├── docs/
│   ├── 01-product-and-mvp-plan.md
│   ├── 02-system-architecture.md
│   ├── 03-repository-and-delivery-plan.md
│   ├── adr/                         # architecture decision records
│   └── api/                         # OpenAPI contract and examples
├── apps/
│   ├── desktop/                     # Tauri + React + Vite + Bootstrap
│   │   └── src/{features,components,pages,services,stores,styles}/
│   └── mobile/                      # Expo + React Native
│       └── src/{features,components,screens,navigation,services}/
├── packages/
│   ├── api-client/                  # generated TypeScript API client
│   ├── domain/                      # types, schemas, domain constants
│   └── design-tokens/               # color/spacing/type/status tokens
├── services/
│   └── api/                         # Java + Spring Boot application
│       └── src/main/java/com/toman/sales/
│           ├── identity/ organization/ catalog/ crm/
│           ├── inbox/ campaigns/ assistant/ workflows/
│           ├── integrations/ analytics/ audit/ notification/
│           └── common/ config/
├── infra/
│   ├── compose/                     # local Docker configuration
│   ├── database/                    # migrations and seed data
│   └── deployment/                  # cloud manifests later
├── scripts/
└── .env.example
```

## 2. Build sequence

### Step 1 — Establish the product spine

- Initialize the repository, contributor guide, environment example, and Docker Compose.
- Create Spring Boot with health check, OpenAPI, database migrations, tenant context, and audit event service.
- Define the OpenAPI contract before screens become deeply coupled to backend details.

### Step 2 — Deliver the CRM vertical slice

- Create organization, membership, product, customer, lead, stage, task, and activity schemas.
- Build lead CRUD, assignment, pipeline movement, task completion, and timeline APIs.
- Build the desktop sign-in, dashboard shell, lead list/detail, and pipeline board.
- Build the mobile sign-in, today's tasks, and lead update flow.

### Step 3 — Add the assistant safely

- Add tenant-scoped retrieval from approved catalog/FAQ and CRM summaries.
- Begin with read-only tools: lead summary, follow-ups due, pipeline summary.
- Add draft tools: campaign draft and follow-up draft.
- Return structured action proposals and route all execution through an approval service.

### Step 4 — Add the demo integration and automation

- Ingest one website form or mock channel using signed/idempotent webhooks.
- Normalize it into a lead, conversation, and activity timeline.
- Add an email draft and approved simulated/authorized send adapter.
- Add a scheduled follow-up job, notification, and dashboard metric update.

### Step 5 — Verify and package

- Test role boundaries, tenant isolation, approval bypass attempts, webhook replay, and duplicate leads.
- Exercise the exact end-to-end demo with clean seed data.
- Package the Tauri desktop app; build Expo preview/internal-test builds.
- Add monitoring, error reporting, backup validation, and a release checklist before pilot users.

## 3. Definition of done for the first demo

- A reviewer can create a business workspace and log in as Owner or Sales Rep.
- They can create or receive a lead, assign it, move it, and see the activity timeline on desktop and mobile.
- They can ask TOMAN for a follow-up draft and see what information the draft used.
- An approval is required before the simulated/real outbound action; a rejected action does not send.
- The final lead/task/dashboard state and audit record tell one coherent story.

## 4. Architecture decision records to create next

1. `ADR-001`: Tauri + React desktop application versus Electron.
2. `ADR-002`: OIDC identity provider and token/session strategy.
3. `ADR-003`: PostgreSQL tenant isolation and row-level security strategy.
4. `ADR-004`: LLM provider, model routing, prompt/tool audit retention, and data-processing policy.
5. `ADR-005`: First inbound/outbound channel: website form plus email before WhatsApp/social.
6. `ADR-006`: Durable job queue choice and retry/dead-letter policy.

## 5. Items that need a business decision before production

- The first target industry and its most valuable lead workflow.
- Required countries, languages, and privacy/data-residency needs.
- Chosen email provider and verified sending domain.
- Whether WhatsApp Business Platform credentials are already available.
- Identity provider, cloud host, object storage, monitoring, and budget.
- Which actions must always require approval versus allowed automatically.
