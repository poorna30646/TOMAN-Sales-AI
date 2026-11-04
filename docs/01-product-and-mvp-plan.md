# Product and MVP Plan

## 1. Product purpose

TOMAN Sales AI is a multi-tenant sales workspace that helps a business organize leads, conversations, follow-ups, campaigns, and sales insight from one place. Its conversational assistant turns a business request into a safe, explainable proposal or approved action.

The product should feel like an AI sales manager, not an uncontrolled autonomous bot. A business owner remains able to inspect, approve, pause, edit, and undo important work.

## 2. Primary users

| User | Main jobs |
| --- | --- |
| Owner / Admin | Set up the business, integrations, roles, approval rules, products, and goals. |
| Sales manager | Monitor pipeline health, assign leads, review performance, and unblock follow-ups. |
| Sales representative | Work assigned leads, update stages, add notes, complete tasks, and request help from TOMAN. |
| Marketer | Draft campaigns, manage a content calendar, and submit content for review. |
| Prospect / customer | Sends an inquiry through a connected channel and receives permitted communication. |

## 3. MVP promise

For a small business, TOMAN makes every new inquiry visible, creates a structured lead record, helps prepare the next response, and makes the follow-up work impossible to lose.

### One complete demonstration flow

```text
Campaign draft → inquiry/form submission → lead capture and deduplication
→ assistant qualification summary → follow-up draft → human approval
→ simulated or authorized send → task/timeline update → dashboard insight
```

## 4. MVP scope

### Must build

- Secure sign-in, organization setup, and roles: Owner, Manager, Sales Rep, Viewer.
- Product/service catalog with approved descriptions, prices, FAQs, and offers.
- CRM: contacts, leads, customizable stages, ownership, notes, activities, and tasks.
- Desktop dashboard: pipeline, leads needing follow-up, recent activity, basic revenue/lead metrics.
- Mobile companion: today's tasks, lead detail, stage updates, notifications, and assistant chat.
- Conversational assistant that can search tenant-scoped data and create **draft** content/actions.
- Approval inbox for outbound messaging, publishing, workflow activation, and other high-impact actions.
- Email follow-up draft and a mock/authorized send flow; one inbound lead source (form or mock WhatsApp webhook).
- Audit history showing who requested, approved, executed, or failed an action.
- Demo data clearly labeled separately from actual data.

### Intentionally defer

- Fully autonomous sending or publishing.
- A broad social-media integration matrix.
- Full WhatsApp production support until the required business/API access exists.
- Advanced forecasting, billing, marketplace, inventory, and multi-agent collaboration.
- Microservices, Kafka, complex data warehousing, and custom identity infrastructure.

## 5. Release plan

| Phase | Outcome | Deliverables |
| --- | --- | --- |
| 0 — Foundation | A buildable, secure product spine | Monorepo, local Docker environment, tenant model, auth, migrations, audit skeleton. |
| 1 — CRM core | A team can manage leads and work | Catalog, customers, leads, pipeline, activities, tasks, desktop dashboard. |
| 2 — Mobile companion | A rep can act from a phone | Login, task list, lead detail, stage updates, push-notification foundation. |
| 3 — Assisted sales loop | TOMAN helps but does not bypass people | Assistant chat, retrieval, draft generation, approval inbox, action executor. |
| 4 — Channel and workflow demo | The end-to-end story works | Form/mock channel, email draft/send adapter, scheduled follow-up, dashboard events. |
| 5 — Hardening | A credible pilot candidate | Tests, rate limits, retries, consent controls, observability, backup/restore rehearsal. |

## 6. MVP success criteria

- A lead can be captured, deduplicated, assigned, and moved through the pipeline.
- TOMAN can explain why a lead needs attention using available evidence.
- No outbound action occurs without the configured role/approval policy being satisfied.
- Every action appears on a lead timeline and in the audit log.
- Desktop and mobile show the same underlying CRM state within a few seconds.
- A demo can complete the full sales loop using real data or visibly labeled demo data.

## 7. Key risks to address early

- Provider eligibility, consent, templates, and rate limits can delay WhatsApp/social features.
- AI output can be wrong or manipulate tool use; use strict schemas, retrieval boundaries, validation, and approvals.
- Customer records from several channels can duplicate; design matching and merge review early.
- Metrics and attribution can be incomplete; label estimates and missing data instead of inventing explanations.
- Scope can expand quickly; protect the single sales-loop MVP before adding channels or analytics depth.
