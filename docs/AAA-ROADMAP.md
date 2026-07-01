# GovSecure — AAA Product Roadmap

Turning GovSecure from an **AI policy generator** into a **continuous, collaborative, auditable AI governance platform**. This is the story that justifies a AAA price point: not more one-off documents, but a living system of record.

**Status legend:** ✅ done · 🔨 in progress · ⬜ planned

This document tracks Tiers **1, 2, 3, and 5**. (Tier 4 — enterprise readiness: SSO/SAML/SCIM — is deferred.)

---

## Foundation — shared data model

All tiers depend on a small set of new Prisma models. Added in one migration so features can be built in parallel.

| Model | Purpose | Tier |
|---|---|---|
| `AiSystem` | Registry of every AI use case (owner, EU AI Act risk category, lifecycle, review dates) | 1 |
| `ControlAssessment` | Per-control implementation status + evidence, mapped to a framework | 1 |
| `RemediationTask` | Assignable action items with owner, due date, status | 1 |
| `AuditLogEntry` | Immutable governance audit trail | 1 |
| `OrgInvitation` | Pending team invites with role + token | 2 |
| `MaturitySnapshot` | Point-in-time maturity score for trend charts | 3 |
| `RegulatoryUpdate` | Horizon-scanning feed items (jurisdiction/framework tagged) | 3 |

Plus field additions: `User.occupationalRole` (exists) drives role dashboards (T5); `GeneratedArtifact.reviewStatus` + `reviewedById` add an approval workflow (T2); `AiSystem.organizationId` etc. make Tier 1 entities org-shareable (T2).

---

## Tier 1 — The governance moat

Converts point-in-time artifacts into a living system of record. Highest differentiation.

### 1a. AI System Inventory / Register — the flagship
A formal registry of every AI use case the organization runs.
- Fields: name, description, purpose, business owner, vendor/model, lifecycle stage (idea → piloting → production → retired), **EU AI Act risk category** (prohibited / high / limited / minimal), data types processed, deployment date, last-reviewed / next-review dates.
- Links to existing `GeneratedArtifact`s (DPIA, threat model) via `useCaseName`.
- Views: table with risk-tier + review-due filters; detail page with linked docs, controls, tasks.
- **Routes:** `GET/POST /api/ai-systems`, `GET/PATCH/DELETE /api/ai-systems/[id]`
- **Page:** `/inventory`, `/inventory/[id]`

### 1b. Continuous Compliance Posture
Evolves the dashboard "Framework Status" widget into a real control-mapping surface.
- Seeded control catalogs: NIST AI RMF, ISO/IEC 42001, EU AI Act.
- `ControlAssessment` per control: `not-started | in-progress | implemented | not-applicable`, evidence note, last updated by/at.
- Coverage % per framework, gap list, trend over time.
- **Routes:** `GET /api/compliance/frameworks`, `GET/PATCH /api/compliance/assessments`
- **Page:** `/compliance`

### 1c. Remediation / Action tracker
Gaps become work.
- `RemediationTask`: title, description, priority, status (`todo | in-progress | done`), due date, assignee, optional links to an `AiSystem` or control.
- Kanban + list views; overdue highlighting.
- **Routes:** `GET/POST /api/tasks`, `PATCH/DELETE /api/tasks/[id]`
- **Page:** `/tasks`

### 1d. Evidence & Audit vault
- `AuditLogEntry` written on every governance mutation (system created, control updated, policy approved, task closed).
- Immutable, filterable, exportable for auditors.
- **Page:** `/audit`

---

## Tier 2 — Activate teams

The `Organization` / `OrgMember` models exist but the product is still single-player.

- **Invitations + RBAC** — `OrgInvitation` flow (email + token via Resend); roles Owner / Admin / Contributor / Viewer enforced in route handlers.
- **Workspace switcher** — in the sidebar; personal vs org context.
- **Review & approval** — `GeneratedArtifact.reviewStatus` moves draft → in-review → approved with `reviewedById` sign-off.
- **Shared org library** — Tier 1 entities scoped by `organizationId` are visible to the whole team.
- **Routes:** `POST /api/organizations/[id]/invitations`, `POST /api/invitations/accept`, `PATCH /api/artifacts/[id]/review`

---

## Tier 3 — Intelligence & proactivity

Leverages the existing AI stack (multi-agent Govi, embeddings, jurisdiction data).

- **AI Governance Maturity Score** — single 0–100 score across dimensions (inventory coverage, control implementation, review cadence, remediation health). `MaturitySnapshot` stores history for a trend chart. Sticky + upsell surface.
- **Regulatory change feed** — `RegulatoryUpdate` items tagged by jurisdiction/framework, tied to the Governance Globe; personalized to "what changed that affects *your* registered systems."
- **RAG over the user's own documents** — reuse embeddings + `documents/upload`; Govi answers against the org's uploaded policies (source `user-document`).
- **Proactive Govi nudges** — "3 systems lack a completed DPIA," "2 controls overdue for review."

---

## Tier 5 — Engagement & polish

- **Onboarding maturity assessment** — short quiz → seeds a `MaturitySnapshot` + a personalized roadmap of `RemediationTask`s. Builds on `OnboardingWizard` + `occupationalRole`.
- **Role-tailored dashboard** — `User.occupationalRole` reorders dashboard modules (e.g. Legal vs. Founder vs. IT).
- **Board-ready reporting** — executive scorecard export (posture %, maturity trend, top risks) reusing the DOCX/markdown exporters.
- **Command palette (⌘K)** — quick nav to systems, tasks, controls; pairs with the new sidebar.

---

## Build sequence

1. ✅ Foundation migration (all models) — unblocks everything.
2. Tier 1a Inventory (flagship vertical slice) → 1b Compliance → 1c Tasks → 1d Audit.
3. Tier 3 Maturity Score (depends on 1a–1c data).
4. Tier 2 team activation (scopes 1a–1d by org).
5. Tier 5 assessment + role dashboard + reporting (depends on 1 + 3).

Each slice ships: data-access lib in `src/lib/`, route handlers under `src/app/api/`, a page under `src/app/`, and a sidebar nav entry.
