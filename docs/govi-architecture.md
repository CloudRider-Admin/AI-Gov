# Govi Architecture

This document describes the integrated Govi system as it stands at the close of Phase 7 of the GovSecure integration plan. It is intended for engineers and reviewers who need to understand the request lifecycle, the agentic generation layer, the GovSecure knowledge integration, and the cost-control layers without reading every file in `src/lib/ai/`.

The plan that produced this system is `GOVI_GOVSECURE_INTEGRATION_PLAN.md`; the per-phase change log is `GOVI_IMPLEMENTATION_LOG.md`. This doc reflects the resulting architecture, not the path that got us there.

---

## 1. Product surface

Govi is the AI-governance advisor exposed at `/govi`. Two entry points:

- `POST /api/advisor` — synchronous JSON. Returns the full advisor response, generated artifact (if any), and orchestrator metadata in one shot.
- `POST /api/advisor/stream` — Server-Sent-Events stream. Same pipeline, but tokens stream as they arrive so the UI can render incrementally.

Both routes go through identical middleware, RAG, model routing, intent classification, citation validation, and orchestrator dispatch. The only divergence is response framing.

A read-only library browse view at `/govi/library` lists the 82 GovSecure-licensed templates that the advisor can generate from.

---

## 2. Request lifecycle

The pipeline below is implemented in `src/app/api/advisor/route.ts` (and mirrored in `…/stream/route.ts`). Each step has a clear failure mode and a short-circuit out — there is no single point where a thrown exception cascades through the rest of the pipeline.

```
1.  Auth                    src/lib/auth-guard.ts → getOptionalSession()
2.  Rate limit              src/lib/rate-limit.ts (DB-backed, role-aware)
3.  Token budget            src/lib/tokenBudget.ts (monthly, role-aware)
4.  Prompt injection guard  src/lib/security/promptGuard.ts
5.  Advisor cache lookup    src/lib/responseCache.ts → advisorCache
6.  RAG context             src/lib/ai/rag.ts → buildEnhancedRAGContext()
7.  Intent classification   src/lib/ai/intentClassifier.ts → classifyIntent()
8.  Model routing           src/lib/ai/modelRouter.ts → pickAdvisorModel()
9.  OpenAI call             via src/lib/circuitBreaker.ts → openaiCircuit
10. Response parse + Zod    src/lib/ai/responseParser.ts
11. Citation validation     src/lib/ai/citationValidator.ts
12. Persist messages        src/lib/conversation.ts
13. Orchestrator dispatch   src/lib/ai/orchestratorDispatch.ts
14. Apply gating            src/lib/ai/responseParser.ts → applyGating()
15. Cache response          advisorCache.set()
```

Step 13 may itself enqueue a multi-agent pipeline (see §4) and persist a `GeneratedArtifact`. Steps 5 and 13 each consult their own cache (advisor-level vs. artifact-level — see §7).

**Guests** (no session): served at every step except token budget (skipped) and orchestrator dispatch (skipped — generation is gated to authenticated roles). The pipeline still runs OpenAI and returns an advisory response with no artifact.

---

## 3. Knowledge base and RAG

Govi blends five knowledge sources at retrieval time. `buildEnhancedRAGContext()` in `src/lib/ai/rag.ts` is the one entry point; callers do not interact with the individual sources.

| Source | Module | Content |
|---|---|---|
| Static governance KB | `src/lib/ai/knowledgeBase.ts` | Core NIST AI RMF, ISO/IEC 42001, EU AI Act, GDPR, HIPAA primers |
| Vector KB | `src/lib/ai/vectorSearch.ts`, `KnowledgeEntry` (pgvector) | Embedded full-text entries with cosine similarity |
| DB KB | `KnowledgeEntry` (no embedding) | Operator-curated entries from `/admin/knowledge` |
| Sector guidance | `src/data/sectorGuidance.ts` | Industry-specific overlays (healthcare, finance, public sector, etc.) |
| GovSecure library | `src/data/govsecureContent/` + `src/data/govsecureKnowledge.ts` | 82 GovSecure templates, policies, checklists, playbook, blueprint, TPRM |

`EnhancedRAGResult` carries both a flat `sources: string[]` (legacy callers) and a structured `sourcesStructured?: SourceProvenance[]` array. Provenance buckets: `govsecure | nist | static-kb | vector-kb | db-kb | sector-guidance | regulation`. The `RegulationsPanel` UI uses the structured form to surface a GovSecure trust badge per response.

The retrieval budget is dynamic: `totalBudget: 7` documents, allocated proportionally across sources based on intent and query length. pgvector failures degrade gracefully — vector hits drop out, the static and DB sources still serve.

---

## 4. Multi-agent system

The advisor LLM call (step 9 in §2) returns a single-pass response. **Generation orchestrators** (intake / document / playbook) run a deeper multi-agent pipeline before returning their artifact.

`src/lib/ai/multiAgent.ts` (`MultiAgentOrchestrator`) runs four agents:

| Agent | Weight | Role |
|---|---|---|
| `risk-assessor` | 40% | Score risk drivers, classify tier, flag auto-elevation triggers |
| `compliance-expert` | 30% | Map relevant regulations, articles, NIST controls |
| `policy-architect` | 15% | Recommend policies and AI-Chef station alignment |
| `implementation-advisor` | 15% | Sequence rollout actions, identify blockers |

Two passes:
1. Primary agent runs first; the other three run in parallel against the primary's draft.
2. A synthesis agent reconciles contradictions and produces the unified output. Weighted consensus produces a `contested` flag when agents materially disagree — surfaced through to the dispatch result.

Three orchestrators wrap the multi-agent runner:

- **`IntakeOrchestrator`** — produces an AI Intake Risk Assessment (10 risk drivers, 6 auto-elevation triggers, GovSecure 4-Tier model).
- **`DocumentOrchestrator`** — produces one of 33 governance document types (DPIA, threat model, model card, AUP, GovSecure policy suite, GovSecure checklists, evidence pack, etc.).
- **`PlaybookOrchestrator`** — produces a phased implementation playbook (NIST / EU AI Act / ISO 42001 / Combined / GovSecure 90-Day Blueprint).

All three return a markdown export plus typed structured data.

---

## 5. Workflows (multi-turn generation)

Single-shot orchestrators (above) work for queries with sufficient context. **Workflows** handle generation that requires interactive evidence collection — currently the GovSecure TPRM AI Questionnaire (12 sections, ~80 questions, red-flag rules).

`src/lib/ai/workflowOrchestrator.ts` is the framework. `src/lib/ai/workflows/tprm.ts` is the TPRM definition. State lives in the `WorkflowSession` Prisma model (status, current step, answers, evidence links, red flags).

**API surface** under `/api/workflows`:

- `POST /api/workflows/start` — create a session for a registered workflow type. Body is refined against `WorkflowOrchestrator.isRegistered()` so unregistered types return 400, not 500.
- `GET  /api/workflows/[id]` — fetch state for the current step
- `POST /api/workflows/[id]/answer` — submit a step answer (typed by `responseType`: text, longText, boolean, choice, multiChoice, score, evidenceLink)
- `POST /api/workflows/[id]/pause` / `/resume` — explicit pause control
- `POST /api/workflows/[id]/finalize` — run the final synthesis, produce a `GeneratedArtifact`

The `WorkflowOrchestrator` registry is mutable at runtime (`registeredTypes()` / `register()`) so the start route uses `z.string().refine(isRegistered)` rather than a static enum.

`WorkflowPanel.tsx` is the UI: dispatched from an `ActionCardAction { type: 'workflow', workflowType: 'tprm' }` card that surfaces when the advisor query mentions vendors, or directly from the empty-state hint card.

---

## 6. Intent classification and dispatch

`src/lib/ai/intentClassifier.ts` runs before the LLM call to deterministically pre-classify intent based on phrasing patterns. It returns:

```ts
{ type: 'advisor' | 'intake' | 'document' | 'playbook',
  confidence: 'high' | 'medium' | 'low',
  documentType?, framework?, extractedDescription?, needsClarification? }
```

The LLM also emits its own `intent` field in the structured response. `reconcileIntents()` resolves disagreement: deterministic wins when it's high-confidence and specific; the LLM wins when deterministic is `advisor` and the LLM has a generation type.

`src/lib/ai/orchestratorDispatch.ts` receives the reconciled intent and decides:

1. If guest or `advisor` intent — return without dispatching.
2. If intent `needsClarification` — return without dispatching (the LLM's follow-up questions flow through).
3. Otherwise — look up `artifactCache` by deterministic key; on miss, run the relevant orchestrator and persist the artifact.

The cache key is `(intentType, documentType, framework, normalized useCase, role, orgContextHash)` — deliberately *no conversationId*, so two users with identical inputs share a hit.

---

## 7. Caching layers

Three distinct caches:

| Cache | Module | Key | TTL | Cap |
|---|---|---|---|---|
| Advisor response | `advisorCache` in `src/lib/responseCache.ts` | `(query, context, conversationId, role)` | 24h | 200 |
| Artifact | `artifactCache` in `src/lib/responseCache.ts` | `(intentType, docType, framework, useCase, role, orgContextHash)` | 24h | 100 |
| OpenAI prompt prefix | OpenAI-side automatic | First ≥1024 tokens of the message array | OpenAI-managed | — |

`buildArtifactKey()` and `hashOrgContext()` are exported from `responseCache.ts` for use by the dispatcher.

The OpenAI prompt cache only works if the system-prompt prefix stays byte-stable across requests. `src/lib/ai/systemPrompt.ts` documents this contract at the top of the file: dynamic content (RAG, conversation, user message) goes in the trailing user message, never interpolated into the system prompt. Both routes record `usage.prompt_tokens_details.cached_tokens` on the `openai.completed` audit event so cache effectiveness is observable.

---

## 8. Model routing (cost control)

`src/lib/ai/modelRouter.ts` decides which OpenAI model a given advisor turn uses. Pure functions, no side effects, return `{ model, tier, reason, overridden }` so callers can audit.

| Path | Model | Reason |
|---|---|---|
| `advisor` intent + short + question-shaped + no high-stakes markers | `gpt-4o-mini` | `faq-question` |
| Long advisor query (> 240 chars) | `gpt-4o` | `length>240` |
| High-stakes markers (DPIA, GDPR, breach, biometric, etc.) | `gpt-4o` | `high-stakes-marker` |
| Non-question shapes | `gpt-4o` | `not-question-shaped` |
| `intake` / `document` / `playbook` intent | `gpt-4o` | `intent=…` |
| `OPENAI_MODEL` env override | (override) | `env-override` |

The eval rubric judge (`pickJudgeModel()`) defaults to `gpt-4o-mini` since rubric scoring is structured-output classification rather than reasoning. `evals/judge.ts` can be pinned via `EVAL_JUDGE_MODEL`.

Generation orchestrators in `multiAgent.ts` are *not* routed by `pickAdvisorModel` — they read `process.env.OPENAI_MODEL ?? 'gpt-4o'` directly. When tiered orchestrator selection becomes necessary, the natural extension is a `pickGenerationModel()` companion.

---

## 9. Citation validation

`src/lib/ai/citationValidator.ts` runs after parse and validates every citation in the response against a manifest of known regulation IDs and GovSecure document codes. The default manifest (`DEFAULT_GOVSECURE_TEMPLATES`) is built from `getManifestEntries()` at module load — reject-unless-known is the default, not the inverse.

Behavior:
- Known citation → pass.
- Unknown citation → flagged. Below `STRIP_THRESHOLD` (3 in production), emits an audit event but lets the response through. Above threshold, appends a `warnings[]` entry that the UI renders as an amber banner above the response.

This is a guardrail, not a gate — the LLM's own citation hygiene is the primary defense. The validator catches systemic hallucinations.

---

## 10. Eval harness

`src/lib/ai/evals/` is the offline evaluation suite. The workflow:

- **Golden cases** in `src/lib/ai/evals/golden/*.golden.json` — 30 deterministic scenarios with expected risk tier, document type, and citation set.
- **Runner** (`runner.ts`) loads the cases, runs each through the real advisor pipeline (mock or live OpenAI), persists per-case JSON.
- **Judge** (`judge.ts`) scores each case with an LLM rubric (semantic match, citation correctness, tone alignment).
- **Rubric** (`rubric.ts`) v1.1.0 — 8 dimensions per case.
- **Scripts**: `npm run eval:govi` (live), `npm run eval:govi:mock` (deterministic, no API key).

CI runs `eval:govi` on every PR via `.github/workflows/govi-eval.yml`. PRs from forks (no secret) auto-fall-back to mock mode.

`evals/baseline.json` is the merged reference. Promoting a new baseline requires `npm run eval:govi -- --update-baseline`. The current baseline is the mock-mode 30/30 reference; a quota'd live baseline is queued in operational follow-up.

---

## 11. Branded export

`src/lib/exporters/` produces final artifact deliverables in two formats:

- `govSecureWordExporter.ts` — `.docx` with GovSecure brand styles
- `govSecurePdfExporter.ts` — `.pdf` rendered from the same source

Shared infrastructure:
- `documentCode.ts` — assigns sequential `GS-AIPS-{type}-{userId}-{n}` codes
- `licenseBlock.ts` — appends GovSecure license boilerplate
- `styles.ts` — brand colors, typography, spacing constants

Triggered via `POST /api/artifacts/[id]/export`. Format negotiated by query param.

---

## 12. Persistence

Prisma models in `prisma/schema.prisma`:

| Model | Purpose |
|---|---|
| `User`, `Account`, `Session`, `VerificationToken` | NextAuth identity |
| `PasswordResetToken` | Manual reset flow |
| `Conversation`, `Message` | Advisor thread persistence |
| `GeneratedArtifact` | Output of intake / document / playbook orchestrators |
| `WorkflowSession` | Multi-turn workflow state (Phase 3.5) |
| `KnowledgeEntry` | Static + vector KB (pgvector embedding column) |
| `RateLimit` | Per-(id, endpoint) request counts |
| `TokenUsage` | Per-user OpenAI token consumption (monthly bucket) |
| `IntentFeedback` | Operator feedback on intent classification accuracy |
| `Organization`, `OrgMember` | Multi-tenant org support (Phase 4.5 OrgContext joins here) |
| `WebhookEndpoint` | Outbound event delivery |
| `AnalyticsEvent` | Internal analytics (via `src/lib/analytics.ts`) |
| `NewsletterSubscriber` | Marketing site list |

The `KnowledgeEntry.embedding` column is populated by the seed scripts but no live job updates embeddings on row insert today; vector search is mostly used for the seeded corpus, not user-added entries.

---

## 13. Auth and gating

`NextAuth` with JWT strategy. Roles: `GUEST` (unauthenticated) → `FREE` → `PRO` → `TEAM` → `ENTERPRISE` → `ADMIN`.

- **Public**: marketing site routes, `/govi` advisor (advisor-only, no generation), `/govi/library`
- **Authenticated**: `/dashboard`, generation orchestrators, workflows, exports
- **Admin**: `/admin/*`, `/studio` (Sanity)

`applyGating()` in `src/lib/ai/responseParser.ts` strips fields from the advisor response based on role — e.g., `generatedArtifact` is null for `GUEST` even when the deterministic classifier says generation is appropriate, because the dispatcher short-circuits guests.

---

## 14. Observability

Three signals:

- **Audit log** — `src/lib/utils/logger.ts`. Typed `LogEvent` union; structured key/value data per event. Written via `auditLog()` at every step boundary. Today emits to console; a future Sentry/Datadog adapter slots in here.
- **Token usage** — `recordTokenUsage()` writes per-call rows to `TokenUsage`. Aggregated by `checkTokenBudget()` against role-based monthly limits.
- **Analytics events** — `src/lib/analytics.ts` writes to `AnalyticsEvent`. Consumed by `/admin/analytics`.

`openai.completed` is the high-leverage event: it carries `model`, `modelTier`, `modelReason`, `promptTokens`, `cachedPromptTokens`, `completionTokens`, and `durationMs`. This is the source of truth for cost dashboards.

---

## 15. Resilience

- **Circuit breaker** — `src/lib/circuitBreaker.ts`. Singleton `openaiCircuit` opens after a configurable failure rate; clients receive a fast 503 with `Retry-After` instead of waiting for a timeout. Known limitation: the breaker is global, so one user's failure trips the breaker for all users.
- **Rate limiting** — `src/lib/rate-limit.ts`. DB-backed sliding window, role-aware. Today keyed off `x-forwarded-for` (spoofable; see Known Issues).
- **Token budget** — Hard monthly cap per role. Returns 429 with the consumed and limit values for client-side display.
- **Fallback responses** — `buildFallbackResponse()` in `src/lib/ai/schemas.ts`. Used when OpenAI is missing, the circuit is open, or quota is exceeded — returns a coherent advisor response shape so the UI doesn't break.

---

## 16. File map (start here when navigating the codebase)

| Concern | Entry point |
|---|---|
| Add a new advisor middleware | `src/app/api/advisor/route.ts` (mirror in `…/stream/route.ts`) |
| Tune RAG retrieval | `src/lib/ai/rag.ts` |
| Add a new agent or rebalance weights | `src/lib/ai/multiAgent.ts` |
| Add a new document type | `src/lib/ai/intentClassifier.ts` (pattern), `src/lib/ai/documentTemplates.ts` (template), `src/lib/ai/schemas.ts` (`DOCUMENT_TYPE_VALUES`), `src/components/advisor/documentTypeMeta.ts` (UI label) |
| Add a new workflow | `src/lib/ai/workflows/<name>.ts`, register in `workflowOrchestrator.ts` |
| Tune model routing | `src/lib/ai/modelRouter.ts` |
| Add a knowledge source | `src/lib/ai/rag.ts` (composer) + the source module |
| Tune prompt prefix | `src/lib/ai/systemPrompt.ts` (preserve byte-stable prefix invariant) |
| Add a new audit event | `src/lib/utils/logger.ts` (extend `LogEvent` union) |
| Modify GovSecure content | `src/data/govsecureContent/` (re-run `scripts/ingestGovSecureLibrary.py`) |
| Add an eval golden case | `src/lib/ai/evals/golden/*.golden.json` |

---

## 17. Known limitations

These are tracked in memory and `RECOMMENDATIONS.md`; calling them out here so this doc reflects ground truth:

- `openaiCircuit` is a global singleton (not per-user)
- IP rate limiting reads `x-forwarded-for` (spoofable behind some proxies)
- No CSP headers in `next.config.js`
- `streamBuffer.ts` in-memory buffer has no TTL
- `TokenUsage` rows accumulate without a cleanup job
- `KnowledgeEntry.embedding` populated at seed time only — no live update job
- `Advisor.tsx` is monolithic (702 lines as of Phase 6 follow-up)
- Live eval baseline still on mock mode pending a quota'd OpenAI key

These are real but non-blocking for the current product surface. The cost-related ones (token-usage cleanup, per-tier breakdown) are the natural next operational follow-ups after the integration work in this plan.
