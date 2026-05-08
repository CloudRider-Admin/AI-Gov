# Govi × GovSecure Content Library Integration Plan

**Version**: 1.0
**Date**: 2026-05-05
**Status**: Approved for Execution
**Owner**: Govi Engineering
**Document Code**: GOVI-GS-INTEG-V1

---

## 1. Executive Summary

This document defines the comprehensive plan to make **Govi** (the GovSecure platform's AI advisor) study, understand, and operationalize **GovSecure's proprietary content library** (82 documents — policies, checklists, playbooks, the AI Chef™ Operating Model, the 90-Day Blueprint, the TPRM Questionnaire, and the NIST RCM) so that Govi can:

1. **Answer user queries** grounded in GovSecure's methodology, terminology, and frameworks
2. **Generate documents** that match the structure, voice, and quality of the real GovSecure templates
3. **Maintain regulatory grounding** in NIST AI RMF, EU AI Act, ISO/IEC 42001, and emerging regulations

The plan is structured as **13 phases** delivered across three workstreams (Foundation, Generation, Operations). It corrects 5 critical gaps identified in the initial integration review:

| Gap | Severity | Resolution Phase |
|---|---|---|
| Manual content transcription is not feasible at scale (~150K words) | Critical | **Phase 0** — Automated extraction pipeline |
| No few-shot exemplars → outputs miss GovSecure brand voice | Critical | **Phase 2.5** — Exemplar retrieval |
| One-shot generation will fail for TPRM/Blueprint (multi-section, iterative) | Critical | **Phase 3.5** — WorkflowOrchestrator |
| Markdown ≠ deliverable; users expect branded .docx/.pdf | Critical | **Phase 2.6** — Branded export pipeline |
| No quality measurement → silent regressions in production | Critical | **Phase 1.5** — Eval harness |

**Total scope**: 4 new files for Phase 0, ~7 new files for new orchestration layers, ~12 existing files extended, 1 Prisma schema migration. Zero breaking changes to the existing pipeline.

**Estimated effort**: 6–8 engineering weeks for full delivery; 3 weeks to ship the Foundation layer (Phases 0, 1, 1.5, 1.6) which alone delivers measurable advisory quality improvements.

---

## 2. Goals and Non-Goals

### 2.1 Goals (in priority order)

1. **G1 — Knowledge Grounding**: Every advisory response cites GovSecure's frameworks (AI Chef stations, 4-tier risk model, Policy Suite tiers, 90-Day phases) when relevant.
2. **G2 — Document Fidelity**: Generated GovSecure policies, checklists, and playbooks are structurally and stylistically indistinguishable from the originals to a non-expert reader. Pass rate target: ≥80% on the eval harness rubric.
3. **G3 — Conversational Workflows**: TPRM, 90-Day Blueprint, and other multi-section documents support iterative, multi-turn completion with state persistence.
4. **G4 — Branded Deliverables**: Final outputs render as `.docx` and `.pdf` files with GovSecure branding, license boilerplate, document codes, and version footers.
5. **G5 — Hallucination Safety**: Govi never fabricates regulations, NIST control IDs, or legal requirements. Every cited control/regulation is verifiable against the seed knowledge base.
6. **G6 — Maintainability**: When GovSecure publishes new or updated content, the system can re-ingest in under 30 minutes with no engineer intervention beyond running a script.

### 2.2 Non-Goals

- Replacing human review of generated governance documents (Govi is decision-support, not auto-approval)
- Real-time collaboration / multi-user document editing in v1
- Localization to languages beyond English in v1
- Public API for third-party access to GovSecure content (licensing scope prohibits this)
- Re-architecting the existing OpenAI/multi-agent pipeline

---

## 3. Current State Assessment

### 3.1 What Govi Has Today

| Layer | Implementation |
|---|---|
| **LLM** | OpenAI GPT-4o (configurable via `OPENAI_MODEL`) |
| **Embedding** | `text-embedding-3-small` (1536d) |
| **Vector store** | PostgreSQL + pgvector |
| **Knowledge base** | NIST AI RMF (72 subcategories), EU AI Act, ISO 42001, GDPR-for-AI, 17 sector guides, 9 emerging regulations (~115 seed entries) |
| **RAG pipeline** | `src/lib/ai/rag.ts` — 4 sources, top-7 retrieval with relevance scoring |
| **Multi-agent consensus** | 4 agents (Risk 40%, Compliance 30%, Policy 15%, Strategy 15%) — `src/lib/ai/multiAgent.ts` |
| **Orchestrators** | IntakeOrchestrator, DocumentOrchestrator (11 doc types), PlaybookOrchestrator (4 frameworks) |
| **Persistence** | Prisma + Postgres — Conversation, Message, GeneratedArtifact, KnowledgeEntry, TokenUsage |
| **Streaming** | SSE with reconnection support — `src/app/api/advisor/stream/route.ts` |
| **Security** | Prompt injection guard, rate limiting, token budgets, circuit breaker, audit logging |
| **Billing** | Stripe; FREE/PRO/TEAM/ENTERPRISE roles with feature gating |

### 3.2 What's Missing

| Capability | Status |
|---|---|
| GovSecure IP in knowledge base | ❌ None |
| GovSecure-style policy generation | ❌ Generic templates only |
| GovSecure checklists (24 types) | ❌ Only `evidence-pack` exists, partially aligned |
| AI Chef Operating Model playbook | ❌ Not modeled |
| 90-Day Blueprint as guided implementation | ❌ Not modeled |
| TPRM 12-section questionnaire | ❌ Not modeled |
| NIST RCM as structured data | ❌ Only as prose in NIST seed entries |
| Branded `.docx`/`.pdf` export | ❌ Markdown only |
| Multi-turn document completion | ❌ One-shot generation only |
| Quality eval harness | ❌ None |
| Hallucination guardrails | ❌ None beyond schema validation |
| Cross-document org consistency | ❌ None |

---

## 4. Critical Gaps and Resolutions (Summary)

The integration review identified five critical gaps in the original phased plan. Each is resolved by a dedicated new phase.

### Gap 1 — Manual Transcription Underestimated
**Problem**: The original plan assumed humans would transcribe ~150K words from .docx/.xlsx files into TypeScript constants. This is 3–4 weeks of error-prone labor and creates a maintenance trap.
**Resolution**: **Phase 0** builds an automated extraction pipeline using `python-docx`, `pdfplumber`, and `openpyxl`. Output is structured JSON that `govsecureKnowledge.ts` imports.

### Gap 2 — No Brand-Voice Exemplars
**Problem**: Section guidance strings alone won't make GPT-4o produce GovSecure's distinctive voice. The original plan would yield competent-but-generic policies.
**Resolution**: **Phase 2.5** adds exemplar retrieval — at generation time, Govi pulls 1–2 actual GovSecure sections as in-context exemplars to anchor tone, structure, and density.

### Gap 3 — Multi-Section Documents Need Workflows
**Problem**: TPRM has 70+ questions across 12 sections; the Blueprint has 13 weeks of phase-gated activities. One-shot generation fails for these.
**Resolution**: **Phase 3.5** introduces a `WorkflowOrchestrator` with stateful `WorkflowSession` records (Prisma migration). Govi asks one section at a time, validates inputs, scores red-flag triggers in real time, and resumes across visits.

### Gap 4 — Output Format Mismatch
**Problem**: The user is paying for branded `.docx` and `.pdf` deliverables. Markdown export is not the product.
**Resolution**: **Phase 2.6** builds a branded exporter using `docx`, `jspdf`, `mammoth` (already in `package.json`). Templates encode GovSecure styles, document codes, footers, and license boilerplate.

### Gap 5 — No Quality Measurement
**Problem**: Without an eval harness, regressions ship silently and quality cannot be verified against the originals.
**Resolution**: **Phase 1.5** stands up a golden test set + LLM-judge rubric. Wired into CI with regression gates.

---

## 5. The Full Phased Plan

### Workstream Map

```
FOUNDATION ──────────────────► GENERATION ──────────────────► OPERATIONS
│                              │                              │
├ Phase 0    Extract           ├ Phase 2    Policies+Checklists ├ Phase 6  UI Polish
├ Phase 1    Seed KB           ├ Phase 2.5  Exemplars          ├ Phase 7  Token Optimization
├ Phase 1.5  Eval Harness      ├ Phase 2.6  Branded Export
├ Phase 1.6  Guardrails        ├ Phase 3    AI Chef + Blueprint + TPRM
├ Phase 4    Agent Contexts    ├ Phase 3.5  WorkflowOrchestrator
├ Phase 4.5  OrgContext        ├ Phase 5    Schemas
```

---

### PHASE 0 — Automated Content Extraction Pipeline 🔵 NEW

**Objective**: Convert the 82 GovSecure source files into structured, version-controllable JSON that downstream phases consume.

**Why first**: Every other phase depends on this data. Manual transcription is not viable at the scale required.

**Estimated effort**: 2–3 engineer-days.

#### 0.1 Install extraction dependencies

Add to `requirements-extraction.txt` (new file at repo root, used only by the script — not part of the runtime stack):

```
python-docx>=1.1.0
pdfplumber>=0.10.0
openpyxl>=3.1.0
```

#### 0.2 Create the extraction script

**File**: `scripts/ingestGovSecureLibrary.py` *(new)*

Walks `GovSecure Project-20260505T105940Z-3-001/GovSecure Project/`, identifies file category from path, and emits structured JSON.

**Output structure**:

```
src/data/govsecureContent/
├── manifest.json                          # Index of all source files with metadata
├── policies/
│   ├── ai-acceptable-use.json             # { sourcePath, version, sections: [{ heading, level, paragraphs, bullets }] }
│   ├── ai-governance.json
│   ├── ai-data-handling-privacy.json
│   ├── ai-risk-approval.json
│   ├── ai-security.json
│   ├── ai-incident-response.json
│   ├── human-oversight.json
│   └── third-party-vendor.json
├── checklists/
│   ├── ai-evidence-pack.json
│   ├── ai-intake-triage.json
│   ├── ai-incident-response.json
│   ├── ai-inventory-system-registry.json
│   ├── ai-model-validation.json
│   ├── ai-monitoring-revalidation.json
│   ├── ai-policy-to-control-mapping.json
│   ├── ai-privacy-dpia.json
│   ├── ai-regulatory-change-impact.json
│   ├── ai-risk-assessment-template.json
│   ├── ai-security-review.json
│   ├── ai-third-party-vendor-dd.json
│   ├── ai-training-role-based.json
│   ├── ai-change-management.json
│   ├── ai-human-oversight-escalation.json
│   ├── govsecure-aup-generator.json
│   ├── govsecure-incident-response.json
│   ├── govsecure-procurement-review.json
│   ├── govsecure-tool-inventory.json
│   ├── govsecure-use-case-registry.json
│   ├── shadow-ai-discovery.json
│   └── vendor-ai-due-diligence.json
├── playbooks/
│   ├── ai-chef-toolkit.json               # Full 24-recipe matrix + RACI + HarborCraft scenario
│   ├── ai-chef-operational-templates.json # Excel sheet → JSON
│   ├── third-party-privacy-assessment.json
│   ├── third-party-privacy-workbook.json  # Excel scoring workbook → JSON
│   └── 90-day-blueprint.json
├── frameworks/
│   └── nist-rcm-v5.json                   # Excel control matrix → JSON, one row per control
└── questionnaires/
    └── tprm-ai-questionnaire.json         # 12 sections, 70+ questions with scoring metadata
```

**Schema for policy/checklist JSON**:

```json
{
  "documentCode": "GS-AIPS-AUP-01",
  "title": "Enterprise AI Acceptable Use Policy",
  "category": "policy",
  "subType": "acceptable-use",
  "sourcePath": "Policies/.../Enterprise_AI_Acceptable_Use_Policy_Licensed.docx",
  "extractedAt": "2026-05-05T...",
  "checksum": "sha256:...",
  "metadata": {
    "version": "Licensed",
    "license": "Internal business use only — restricted from redistribution",
    "tier": "Tier 1 — Core Starter Set"
  },
  "sections": [
    {
      "id": "1",
      "heading": "Purpose and Scope",
      "level": 1,
      "paragraphs": ["The enterprise establishes...", "..."],
      "bullets": [],
      "tables": []
    },
    {
      "id": "2",
      "heading": "Roles and Responsibilities",
      "level": 1,
      "paragraphs": ["..."],
      "bullets": ["AI Governance Lead — runs intake process...", "..."]
    }
  ],
  "boilerplate": {
    "license": "...",
    "disclaimer": "...",
    "footerCode": "GS-AIPS-AUP-01"
  }
}
```

**Schema for checklist JSON** — same as above, plus a normalized `items[]` array per section:

```json
"sections": [
  {
    "id": "1",
    "heading": "Registry Governance Setup",
    "items": [
      { "id": "1.1", "text": "Registry owner assigned", "type": "checkbox" },
      { "id": "1.2", "text": "Registry backup owner assigned", "type": "checkbox" }
    ]
  }
]
```

**Schema for AI Chef toolkit**:

```json
{
  "stations": [
    {
      "id": "S1",
      "name": "Governance Foundation",
      "purpose": "...",
      "recipes": [
        {
          "id": "R1.1",
          "name": "Recipe name",
          "riskTier": "Low",
          "activities": [...],
          "raci": { "responsible": "...", "accountable": "...", "consulted": [...], "informed": [...] },
          "deliverables": [...]
        }
      ]
    }
  ],
  "raciMatrix": [...],
  "workedExample": { "company": "HarborCraft Home Goods", "scenario": "..." }
}
```

**Schema for TPRM**:

```json
{
  "sections": [
    {
      "id": "1",
      "name": "Vendor / Provider Profile",
      "questionCount": 12,
      "questions": [
        {
          "id": "1.1",
          "text": "...",
          "responseType": "short-answer | yes-no | yes-no-partial | select-all | attachment | date",
          "evidenceRequested": "...",
          "scoringRubric": {
            "1": "Informational / low concern",
            "5": "Critical concern / automatic escalation"
          },
          "redFlagTrigger": null | "..."
        }
      ]
    }
  ]
}
```

#### 0.3 Script behavior

- **Idempotent**: Re-running produces identical output (deterministic ordering, stable IDs)
- **Versioned**: `checksum` field detects when source changed; CI fails if JSON drift without source change
- **Validated**: Outputs pass a JSON Schema check (define in `src/data/govsecureContent/_schemas/`)
- **Logged**: `manifest.json` captures source path, extraction date, document code, section count

#### 0.4 Files

| File | Action |
|---|---|
| `scripts/ingestGovSecureLibrary.py` | Create |
| `requirements-extraction.txt` | Create |
| `src/data/govsecureContent/**` | Create (auto-generated) |
| `src/data/govsecureContent/_schemas/*.json` | Create (validation) |
| `package.json` | Add npm script `ingest:govsecure` that invokes the Python script |

#### 0.5 Acceptance criteria

- [ ] All 82 source files have a corresponding entry in `manifest.json`
- [ ] At least 95% of section headings preserved verbatim from sources (sample audit)
- [ ] All Excel files parsed without data loss (NIST RCM rows count matches source)
- [ ] Re-running the script on identical sources produces identical output (`git diff` is empty)
- [ ] JSON Schema validation passes on all output files

---

### PHASE 1 — GovSecure Knowledge Foundation

**Objective**: Make Govi answer governance questions grounded in GovSecure's methodology — referencing AI Chef stations, the 4-tier risk model, Policy Suite tiers, 90-Day Blueprint phases, and named GovSecure templates.

**Estimated effort**: 3 engineer-days (after Phase 0).

#### 1.1 Create `src/data/govsecureKnowledge.ts` (typed loader)

This file **imports the JSON from Phase 0** and exposes typed TypeScript constants. It does **not** embed text inline.

```typescript
// src/data/govsecureKnowledge.ts
import aiChefRaw from './govsecureContent/playbooks/ai-chef-toolkit.json';
import blueprintRaw from './govsecureContent/playbooks/90-day-blueprint.json';
import policySuiteRaw from './govsecureContent/policies/_suite-map.json';
import nistRcmRaw from './govsecureContent/frameworks/nist-rcm-v5.json';

export const GOVSECURE_AI_CHEF: AIChefToolkit = aiChefRaw as AIChefToolkit;
export const GOVSECURE_90_DAY_BLUEPRINT: BlueprintModel = blueprintRaw as BlueprintModel;
export const GOVSECURE_POLICY_SUITE: PolicySuiteMap = policySuiteRaw as PolicySuiteMap;
export const GOVSECURE_RISK_MODEL: RiskTierModel = { /* Hard-coded tier definitions, since these are stable */ };
export const GOVSECURE_NIST_RCM: NISTControl[] = nistRcmRaw as NISTControl[];

// Convenience lookups
export function getStationById(id: string): GovsecureStation | undefined { ... }
export function getRecipeById(id: string): GovsecureRecipe | undefined { ... }
export function getControlsForFunction(fn: 'GOVERN' | 'MAP' | 'MEASURE' | 'MANAGE'): NISTControl[] { ... }
```

**Type definitions** in `src/types/govsecure.ts` *(new)*: `AIChefToolkit`, `GovsecureStation`, `GovsecureRecipe`, `BlueprintModel`, `BlueprintPhase`, `PolicySuiteMap`, `PolicyEntry`, `RiskTierModel`, `NISTControl`.

#### 1.2 Extend `src/lib/knowledge/seedData.ts`

Add three new builder functions following the existing `buildNistEntries()` pattern:

```typescript
function buildGovSecurePolicyEntries(): SeedEntry[] {
  // For each of 8 policies in src/data/govsecureContent/policies/:
  //   For each section:
  //     emit one SeedEntry with:
  //       title: "{policyTitle} — {sectionHeading}"
  //       content: section paragraphs + bullets joined as prose
  //       category: 'policy'
  //       tags: ['govsecure', 'policy', subType, tier]
  //       sourceType: 'govsecure'
}

function buildGovSecureChecklistEntries(): SeedEntry[] {
  // For each of 24 checklists:
  //   Emit ONE entry per checklist with:
  //     title: checklist title
  //     content: purpose + section headings + key items as prose paragraphs
  //     (NOT raw bullet lists — semantic search works better on prose)
  //     tags: ['govsecure', 'checklist', subType]
}

function buildGovSecureFrameworkEntries(): SeedEntry[] {
  // AI Chef stations (one entry per station summarizing its 4 recipes)
  // 90-Day Blueprint (one entry per phase)
  // 4-tier risk model (one entry per tier with decision criteria)
  // Policy Suite Map (one entry per tier listing the policies)
}
```

Update `getAllSeedEntries()`:

```typescript
export async function getAllSeedEntries(): Promise<SeedEntry[]> {
  return [
    ...buildNistEntries(),
    ...buildEuAiActEntries(),
    ...buildIsoEntries(),
    ...buildGdprEntries(),
    ...buildSectorGuidanceEntries(),
    ...buildEmergingRegulationEntries(),
    // NEW:
    ...buildGovSecurePolicyEntries(),       // ~80 entries (8 policies × ~10 sections)
    ...buildGovSecureChecklistEntries(),    // ~24 entries (one per checklist)
    ...buildGovSecureFrameworkEntries(),    // ~30 entries (stations, phases, tiers, policies)
  ];
}
```

**Target**: ~135 new GovSecure entries, total ~250 (up from ~115).

#### 1.3 Extend `src/app/api/knowledge/seed/route.ts`

The existing seed loop already calls `getAllSeedEntries()` and upserts everything. **No code change needed** — verify only that the new entries upsert correctly.

After deployment, the operator runs:
```bash
curl -X POST $APP/api/knowledge/seed   # Upserts all entries (idempotent)
curl -X POST $APP/api/knowledge/embed  # Generates embeddings for any unembedded entries
```

Embedding cost estimate: 135 entries × ~400 tokens average × $0.02/1M tokens ≈ **$0.001 total**. Negligible.

#### 1.4 Update System Prompt

Both `src/app/api/advisor/route.ts` (line 18) and `src/app/api/advisor/stream/route.ts` (line 40) define the identical 138-line `GOVERNANCE_SYSTEM_PROMPT` constant.

**Refactor first**: Extract the prompt to `src/lib/ai/systemPrompt.ts`. This is a 5-minute change that prevents future drift between the two routes. After extraction, both routes import from the shared module.

**Then add**:

```
EXPERTISE EXTENSION — GovSecure AI Governance Framework:
You have deep knowledge of GovSecure's proprietary governance products:
- The AI Chef™ Operating Model: 6 governance stations (Governance Foundation, Risk Assessment Kitchen, Policy Development Station, Vendor Management Prep, Monitoring Station, Incident Response Station), each with 4 recipes mapped to risk tiers.
- The 90-Day Implementation Blueprint: 3 phases (Foundation weeks 1–4, Implementation weeks 5–8, Operationalization weeks 9–13), aligned to NIST AI RMF functions.
- The 15-policy Policy Suite Map across 3 tiers: Starter, Operational Control, Maturity/Assurance.
- The 4-tier Risk Model: Low / Moderate / High / Prohibited, with specific GovSecure trigger conditions for each tier.
- The TPRM AI Questionnaire: 12-section vendor privacy risk assessment with 1–5 scoring and red-flag triggers.

GOVSECURE METHODOLOGY — Apply when answering governance questions:
- Use GovSecure's 4-tier risk model when discussing risk classification.
- Reference AI Chef stations and recipes when explaining governance activities.
- Reference 90-Day Blueprint phases when users ask about implementation timelines.
- When recommending policies, use Policy Suite Map tiers (Starter/Operational/Maturity).
- Cite GovSecure templates by name when directly relevant (e.g., "the GovSecure Shadow AI Discovery Workflow").
- Never recommend a control or regulation that does not appear in your retrieved context. If unsure, ask a clarifying question.

DOCUMENT TYPE MAPPING — When the user requests document generation, use these documentType values:
[Updated list of all 22+ GovSecure document types added in Phase 2]
```

System prompt grows from 138 → ~175 lines. GPT-4o context cost: negligible.

#### 1.5 Files

| File | Action | Notes |
|---|---|---|
| `src/types/govsecure.ts` | Create | Type definitions |
| `src/data/govsecureKnowledge.ts` | Create | Typed loader (imports JSON) |
| `src/lib/knowledge/seedData.ts` | Extend | 3 new builder functions |
| `src/lib/ai/systemPrompt.ts` | Create (refactor) | Extracted shared prompt |
| `src/app/api/advisor/route.ts` | Edit | Import from `systemPrompt.ts` |
| `src/app/api/advisor/stream/route.ts` | Edit | Import from `systemPrompt.ts` |

#### 1.6 Acceptance criteria

- [ ] `getAllSeedEntries()` returns ≥250 entries
- [ ] After `/api/knowledge/seed` + `/api/knowledge/embed`, vector search returns ≥1 GovSecure-tagged result for queries: *"acceptable use policy"*, *"vendor risk assessment"*, *"90 day plan"*, *"risk tier"*, *"AI Chef"*
- [ ] System prompt refactor passes existing test suite
- [ ] Manual smoke test: ask Govi *"how should I prioritize AI policies?"* → response references GovSecure Policy Suite tiers (Starter/Operational/Maturity)

---

### PHASE 1.5 — Eval Harness 🔵 NEW

**Objective**: Establish quality measurement before any generation features ship. Without this, regressions are invisible.

**Estimated effort**: 4 engineer-days.

#### 1.5.1 Golden test set

**Directory**: `src/lib/ai/evals/golden/` *(new)*

Create golden cases — one per document type and one per advisory query archetype.

**Format** (`*.golden.json`):

```json
{
  "id": "policy-aup-smb-ecommerce",
  "category": "document-generation",
  "documentType": "govsecure-aup",
  "input": {
    "useCaseDescription": "280-person ecommerce SMB using ChatGPT Enterprise, Microsoft Copilot, and Zendesk AI for customer support",
    "industry": "ecommerce",
    "riskTier": "moderate"
  },
  "expectedSections": [
    "Purpose and Scope",
    "Roles and Responsibilities",
    "Permitted Uses",
    "Prohibited Uses",
    "Data Handling Requirements",
    "Human Review Requirements",
    "Training and Awareness",
    "Enforcement and Exceptions",
    "Review and Maintenance",
    "License and Disclaimer"
  ],
  "requiredClauses": [
    "AI Governance Lead",
    "intake process",
    "human review",
    "sensitive data submission"
  ],
  "forbiddenContent": [
    "<unverified regulation citations>",
    "<fabricated NIST control IDs>"
  ],
  "exemplarPath": "src/data/govsecureContent/policies/ai-acceptable-use.json",
  "voiceTargetSections": ["1", "2"]
}
```

**Coverage target**: 30 golden cases at v1 (8 policies × 1 each, 24 checklists × 0.5, 4 playbook variants × 1, TPRM × 2, advisory queries × 5).

#### 1.5.2 Eval rubric (LLM judge)

**File**: `src/lib/ai/evals/rubric.ts` *(new)*

```typescript
export interface EvalScore {
  structureMatch: number;        // 0-1: % of expectedSections present in output
  requiredClausesPresent: number; // 0-1: % of requiredClauses found
  hallucinationCheck: 'pass' | 'fail'; // any forbiddenContent? any unverified citations?
  voiceMatch: number;             // 0-1: LLM judge score against exemplar
  overall: number;                // weighted: 0.3*structure + 0.3*clauses + 0.3*voice + 0.1*hallucination
}

export async function evaluateGeneration(
  goldenCase: GoldenCase,
  generatedOutput: GeneratedDocument
): Promise<EvalScore>;
```

**LLM judge prompt** (uses GPT-4o, separate from the generating model to reduce bias):

```
You are evaluating whether a generated governance document matches the
expected GovSecure template style and content.

[GOLDEN CASE]
[GENERATED OUTPUT]
[EXEMPLAR FROM REAL GOVSECURE LIBRARY]

Score 0.0-1.0:
1. Structure: Does it have the same sections in approximately the same order?
2. Required clauses: Are all listed required clauses present?
3. Voice: Does the prose density, terminology, and tone match the exemplar?
4. Hallucination: Are there any fabricated citations or invented regulations?

Return JSON: { structureMatch, clausesScore, voiceMatch, hallucinations: [...] }
```

#### 1.5.3 Eval runner

**File**: `src/lib/ai/evals/runner.ts` *(new)*

```typescript
export async function runEvalSuite(): Promise<EvalReport> {
  // 1. Load all golden cases from src/lib/ai/evals/golden/
  // 2. For each: invoke the appropriate orchestrator (advisor/document/playbook)
  // 3. Score each output via evaluateGeneration()
  // 4. Aggregate: pass rate, per-category breakdown, regression delta
  // 5. Write report to evals/reports/{timestamp}.json
}
```

**npm script**: `eval:govi` runs the full suite.

#### 1.5.4 CI integration

**File**: `.github/workflows/govi-eval.yml` *(new)*

- Runs on PRs touching `src/lib/ai/**`, `src/data/govsecureContent/**`, `src/data/govsecureKnowledge.ts`
- Threshold: pass rate ≥ baseline − 2%
- Blocks merge on regression
- Posts comment with delta vs. baseline

**Cost note**: Eval suite makes ~30 GPT-4o calls (generation) + ~30 GPT-4o calls (judging) = ~60 calls/run. At ~2K tokens average, ~120K tokens/run ≈ $0.60/run. Acceptable.

#### 1.5.5 Files

| File | Action |
|---|---|
| `src/lib/ai/evals/golden/*.golden.json` | Create (~30 files) |
| `src/lib/ai/evals/rubric.ts` | Create |
| `src/lib/ai/evals/runner.ts` | Create |
| `src/lib/ai/evals/judge.ts` | Create |
| `.github/workflows/govi-eval.yml` | Create |
| `package.json` | Add `eval:govi` script |

#### 1.5.6 Acceptance criteria

- [ ] Eval runner executes locally and produces a report
- [ ] All 30 golden cases run without crashing
- [ ] CI workflow runs on PRs and posts comment
- [ ] Baseline pass rate captured (will start low; target ≥80% by end of Phase 2)

---

### PHASE 1.6 — Hallucination Guardrails 🔵 NEW

**Objective**: Prevent Govi from fabricating regulations, NIST control IDs, or legal citations.

**Estimated effort**: 2 engineer-days.

#### 1.6.1 Citation validator

**File**: `src/lib/ai/citationValidator.ts` *(new)*

```typescript
export interface CitationCheck {
  cited: string;               // text Govi cited (e.g. "NIST AI RMF GOVERN-1.2")
  type: 'nist-control' | 'regulation' | 'iso-clause' | 'govsecure-template';
  verified: boolean;
  source?: string;             // if verified, where it came from
}

export async function validateCitations(
  responseText: string
): Promise<CitationCheck[]>;
```

**Behavior**:
1. Extract all candidate citations via regex (`/NIST AI RMF [A-Z]+-\d+\.\d+/g`, `/Article \d+ of (?:GDPR|EU AI Act)/g`, etc.)
2. Look each up in the seed knowledge base
3. Return per-citation pass/fail with source

#### 1.6.2 Wire into response pipeline

In `src/app/api/advisor/route.ts` and `stream/route.ts`, after the LLM response is parsed and before returning to the user:

```typescript
const citations = await validateCitations(response.content);
const unverified = citations.filter(c => !c.verified);

if (unverified.length > 0) {
  log.warn('unverified citations', { unverified, conversationId });

  if (process.env.NODE_ENV === 'production' && unverified.length > 2) {
    // Strip unverified citations from response and append a soft warning
    response.content = stripCitations(response.content, unverified);
    response.warnings = response.warnings ?? [];
    response.warnings.push('Some citations could not be verified and were removed.');
  }
}
```

#### 1.6.3 Add citation eval to harness

Update `Phase 1.5 rubric` to fail any case where `unverifiedCitations.length > 0` — making this a hard gate.

#### 1.6.4 Files

| File | Action |
|---|---|
| `src/lib/ai/citationValidator.ts` | Create |
| `src/app/api/advisor/route.ts` | Edit (wire validator) |
| `src/app/api/advisor/stream/route.ts` | Edit (wire validator) |
| `src/lib/ai/evals/rubric.ts` | Edit (add citation gate) |

#### 1.6.5 Acceptance criteria

- [ ] Validator extracts known citation formats from sample text
- [ ] All seed entries are queryable as citation sources
- [ ] Injection test: prompt Govi to cite a fake regulation → response either rejects or has the fake citation flagged
- [ ] Eval pass rate not degraded by validator (false-positive rate < 5%)

---

### PHASE 2 — Policy and Checklist Generation

**Objective**: Generate all 8 GovSecure policies and 22+ checklists matching the original templates.

**Estimated effort**: 4 engineer-days.

#### 2.1 Extend `src/types/documents.ts`

Add 22 new `DocumentType` union members (8 policies + 14 checklists). See original plan section 2a for the full list.

```typescript
export type DocumentType =
  // ... existing 11 types ...
  | 'govsecure-aup'
  | 'govsecure-governance-policy'
  | 'govsecure-data-privacy-policy'
  | 'govsecure-risk-approval-policy'
  | 'govsecure-security-policy'
  | 'govsecure-incident-response-policy'
  | 'govsecure-human-oversight-policy'
  | 'govsecure-vendor-policy'
  | 'govsecure-checklist-intake'
  | 'govsecure-checklist-evidence-pack'
  | 'govsecure-checklist-incident-response'
  | 'govsecure-checklist-vendor-dd'
  | 'govsecure-checklist-shadow-ai'
  | 'govsecure-checklist-inventory'
  | 'govsecure-checklist-model-validation'
  | 'govsecure-checklist-monitoring'
  | 'govsecure-checklist-security'
  | 'govsecure-checklist-dpia'
  | 'govsecure-checklist-human-oversight'
  | 'govsecure-checklist-change-management'
  | 'govsecure-checklist-training'
  | 'govsecure-checklist-risk-assessment';
```

#### 2.2 Create `src/data/govsecurePolicies.ts`

Imports JSON from Phase 0. Builds `Record<DocumentType, SectionTemplate[]>` for all GovSecure policies and checklists.

```typescript
import aupRaw from './govsecureContent/policies/ai-acceptable-use.json';
// ... other imports

function toSectionTemplate(section: ExtractedSection): SectionTemplate {
  return {
    heading: section.heading,
    guidance: buildGuidance(section), // Combines original prose + structural hints
    required: section.level === 1,
    govsecureContext: section.paragraphs.join('\n\n'), // Original text for voice anchor
    sourceDocCode: section.documentCode,
    sourceSection: section.id,
  };
}

export const GOVSECURE_POLICY_SECTION_TEMPLATES: Record<GovSecurePolicyType, SectionTemplate[]> = {
  'govsecure-aup': aupRaw.sections.map(toSectionTemplate),
  'govsecure-governance-policy': governanceRaw.sections.map(toSectionTemplate),
  // ... all 8 policies
};

export const GOVSECURE_CHECKLIST_TEMPLATES: Record<GovSecureChecklistType, ChecklistTemplate> = {
  'govsecure-checklist-intake': intakeRaw,
  // ... all 14 checklists
};
```

#### 2.3 Update `SectionTemplate` interface

Extend the existing interface in `src/lib/ai/documentTemplates.ts`:

```typescript
export interface SectionTemplate {
  heading: string;
  guidance: string;
  required: boolean;
  isChecklist?: boolean;
  // NEW:
  govsecureContext?: string;     // Original GovSecure prose for voice matching
  sourceDocCode?: string;        // E.g. "GS-AIPS-AUP-01"
  sourceSection?: string;        // E.g. "1.2"
}
```

#### 2.4 Extend `DOCUMENT_SECTION_TEMPLATES`

Merge GovSecure entries:

```typescript
import {
  GOVSECURE_POLICY_SECTION_TEMPLATES,
  GOVSECURE_CHECKLIST_TEMPLATES,
} from '@/data/govsecurePolicies';

export const DOCUMENT_SECTION_TEMPLATES: Record<DocumentType, SectionTemplate[]> = {
  // ... existing entries ...
  ...GOVSECURE_POLICY_SECTION_TEMPLATES,
  ...Object.fromEntries(
    Object.entries(GOVSECURE_CHECKLIST_TEMPLATES).map(([k, v]) => [k, v.sections])
  ),
};
```

Also extend `docTitles` and `reviewCycles` for the new types.

#### 2.5 Extend `intentClassifier.ts`

Add 22 patterns to `DOCUMENT_TYPE_PATTERNS`. See original plan section 2d.

#### 2.6 Extend Zod schemas (Phase 5 in parallel)

`src/lib/ai/schemas.ts`: Add all new types to `policyRecommendationSchema.documentType` enum.

#### 2.7 Update existing `evidence-pack`

The existing `evidence-pack` document type is already aligned with GovSecure's Evidence Pack Checklist (per code comment in `documentTemplates.ts`). Update its section templates with GovSecure's exact language from `src/data/govsecureContent/checklists/ai-evidence-pack.json` rather than creating a duplicate type.

#### 2.8 Files

| File | Action |
|---|---|
| `src/types/documents.ts` | Extend `DocumentType` union |
| `src/data/govsecurePolicies.ts` | Create (loads JSON) |
| `src/lib/ai/documentTemplates.ts` | Extend templates, titles, cycles, interface |
| `src/lib/ai/intentClassifier.ts` | Add 22 regex patterns |
| `src/lib/ai/schemas.ts` | Extend `documentType` enum |

#### 2.9 Acceptance criteria

- [ ] User prompt *"Generate an Acceptable Use Policy for our 280-person company using Microsoft Copilot"* → returns policy with all expected sections from the AUP exemplar
- [ ] All 22 new document types pass intent classification on positive cases
- [ ] Eval harness pass rate ≥ 70% on policy/checklist golden cases (raised to ≥80% after Phase 2.5)

---

### PHASE 2.5 — Few-Shot Exemplar Retrieval 🔵 NEW

**Objective**: Anchor generation in real GovSecure prose so brand voice, tone, and density match.

**Estimated effort**: 2 engineer-days.

#### 2.5.1 Exemplar retrieval module

**File**: `src/lib/ai/exemplarRetrieval.ts` *(new)*

```typescript
export interface Exemplar {
  documentType: DocumentType;
  sectionId: string;
  heading: string;
  prose: string;
  documentCode: string;
}

export function getExemplarsForGeneration(
  documentType: DocumentType,
  sectionsToGenerate: string[],
  options: { maxExemplars?: number; targetTokens?: number } = {}
): Exemplar[] {
  // Strategy:
  // 1. For each section being generated, find the matching section in the source JSON
  // 2. Pick 1-2 sections that are most representative of the document's voice
  //    (heuristic: longest prose paragraphs, or sections with highest section.level === 1)
  // 3. Truncate to fit targetTokens budget (default 800 tokens)
  // 4. Return as structured exemplars
}
```

#### 2.5.2 Wire into `DocumentOrchestrator`

In `src/lib/ai/multiAgent.ts`, modify the `DocumentOrchestrator.run()` method. Before building the user prompt, call `getExemplarsForGeneration()` and inject:

```typescript
const exemplars = getExemplarsForGeneration(req.documentType, sectionHeadings);

const exemplarBlock = exemplars.length > 0 ? `
REFERENCE EXEMPLARS — These are real sections from the actual GovSecure ${docTitle}.
Match their tone, structure, density, and terminology in your output:

${exemplars.map(ex => `### ${ex.heading} (from ${ex.documentCode})\n${ex.prose}`).join('\n\n')}
` : '';

const userPrompt = `${exemplarBlock}\n\n[generation instructions...]`;
```

This is the single most important quality lever. Without exemplars, GPT-4o produces generic policy text. With exemplars, it produces text that reads like GovSecure wrote it.

#### 2.5.3 Files

| File | Action |
|---|---|
| `src/lib/ai/exemplarRetrieval.ts` | Create |
| `src/lib/ai/multiAgent.ts` | Edit `DocumentOrchestrator.run()` |

#### 2.5.4 Acceptance criteria

- [ ] Exemplar retrieval returns ≥1 exemplar per supported document type
- [ ] Eval harness `voiceMatch` score increases ≥0.15 vs. Phase 2 baseline
- [ ] Manual review by a GovSecure SME: 5 generated outputs rated "matches GovSecure voice" (on 1–5 scale, target ≥4.0 average)

---

### PHASE 2.6 — Branded Export Pipeline 🔵 NEW

**Objective**: Render generated documents as GovSecure-branded `.docx` and `.pdf` files matching the originals' visual style.

**Estimated effort**: 3 engineer-days.

#### 2.6.1 Word template

**File**: `src/lib/exporters/govSecureWordExporter.ts` *(new)*

Uses the `docx` package (already in dependencies). Defines:
- Brand color palette (matches DESIGN_SYSTEM.md)
- Heading styles (Heading 1–4 with exact font, size, color)
- Footer with document code, version, "Confidential — Internal Use Only"
- Header with GovSecure wordmark (image asset in `public/branding/`)
- Standard license/disclaimer block as final section

```typescript
export async function exportToWord(
  document: GeneratedDocument,
  metadata: { documentCode: string; version: string; tier?: string }
): Promise<Buffer>;
```

#### 2.6.2 PDF template

**File**: `src/lib/exporters/govSecurePdfExporter.ts` *(new)*

Uses `jspdf` (already in dependencies). Same brand alignment as Word version.

#### 2.6.3 Wire into artifact persistence

When `DocumentOrchestrator` returns, also generate `.docx` and `.pdf` buffers and persist them as artifact attachments.

Update Prisma schema:

```prisma
model GeneratedArtifact {
  // ... existing fields ...
  docxBlob       Bytes?    @db.LongBlob
  pdfBlob        Bytes?    @db.LongBlob
  documentCode   String?   // E.g. "GS-AIPS-AUP-01-{userId}-{shortHash}"
}
```

Or, preferably, store blobs in object storage (S3/R2) and persist URLs only.

#### 2.6.4 Download endpoint

**File**: `src/app/api/artifacts/[id]/download/route.ts` *(new)*

Query params: `?format=docx|pdf|markdown`. Returns the appropriate blob with `Content-Disposition: attachment`.

#### 2.6.5 UI integration

In `ArtifactViewer.tsx`, add three download buttons: **Word**, **PDF**, **Markdown**.

#### 2.6.6 License boilerplate

Every generated GovSecure policy must end with the standard license block:

```
GovSecure Licensing and Usage
- License scope: This document is licensed for internal business use by the
  purchasing organization and its controlled affiliates...
- No legal advice...
- Customization responsibility...
```

This text is embedded as the final required section in every policy template.

#### 2.6.7 Files

| File | Action |
|---|---|
| `src/lib/exporters/govSecureWordExporter.ts` | Create |
| `src/lib/exporters/govSecurePdfExporter.ts` | Create |
| `src/lib/exporters/styles.ts` | Create (shared brand constants) |
| `prisma/schema.prisma` | Add docxBlob/pdfBlob/documentCode fields |
| `src/app/api/artifacts/[id]/download/route.ts` | Create |
| `src/components/advisor/ArtifactViewer.tsx` | Add download buttons |
| `public/branding/govsecure-wordmark.png` | Asset |

#### 2.6.8 Acceptance criteria

- [ ] Generated `.docx` opens in Microsoft Word with all formatting intact
- [ ] PDF renders identically to Word version
- [ ] License boilerplate appears on every policy
- [ ] Document code follows pattern `GS-{CATEGORY}-{TYPE}-{NUM}` matching the originals
- [ ] Side-by-side comparison with original GovSecure templates: visual fidelity ≥85% (visual review by 2 reviewers)

---

### PHASE 3 — AI Chef Playbook, 90-Day Blueprint, and TPRM

**Objective**: Make GovSecure's flagship products generatable.

**Estimated effort**: 3 engineer-days (depends on Phase 3.5 for TPRM).

#### 3.1 Extend types

```typescript
// src/types/documents.ts
export type PlaybookFramework =
  | 'NIST AI RMF'
  | 'EU AI Act'
  | 'ISO 42001'
  | 'Combined'
  | 'GovSecure AI Chef'      // NEW
  | 'GovSecure 90-Day Blueprint'; // NEW

export type DocumentType =
  // ... + Phase 2 additions
  | 'govsecure-tprm'
  | 'govsecure-nist-rcm';
```

#### 3.2 Create `src/data/govsecurePlaybooks.ts`

Imports Phase 0 JSON. Exports:

```typescript
export const AI_CHEF_STATIONS: GovsecureStation[] = aiChefRaw.stations;
export const GOVSECURE_90_DAY_PHASES: GovsecurePhase[] = blueprintRaw.phases;
export const TPRM_QUESTIONNAIRE: TPRMSection[] = tprmRaw.sections;
```

#### 3.3 Extend `documentTemplates.ts`

Add `GOVSECURE_PLAYBOOK_PHASES` (analogous to `NIST_PLAYBOOK_PHASES`) and `TPRM_SECTION_TEMPLATES`.

#### 3.4 Extend `PlaybookOrchestrator.run()`

In `src/lib/ai/multiAgent.ts`:

```typescript
async run(req: PlaybookRequest) {
  // ... existing NIST/EU/ISO branches ...

  if (req.framework === 'GovSecure AI Chef') {
    return this.generateAIChefPlaybook(req);
  }
  if (req.framework === 'GovSecure 90-Day Blueprint') {
    return this.generate90DayBlueprint(req);
  }
}

private async generateAIChefPlaybook(req: PlaybookRequest) {
  // 1. Pull stations + recipes from AI_CHEF_STATIONS
  // 2. Use HarborCraft worked example as exemplar
  // 3. Map to PlaybookOutput.phases (stations → phases, recipes → tasks)
  // 4. Inject org context (industry, size) for personalization
}
```

The existing `PlaybookOutput` schema accommodates this without changes.

#### 3.5 TPRM via WorkflowOrchestrator (see Phase 3.5)

TPRM does NOT use `DocumentOrchestrator` because it requires multi-turn input. It is implemented as a `WorkflowOrchestrator` workflow.

#### 3.6 Intent patterns

Add to `intentClassifier.ts`:

```typescript
'GovSecure AI Chef': /\b(?:ai\s+chef|chef\s+(?:playbook|operating\s+model|toolkit))\b/i,
'GovSecure 90-Day Blueprint': /\b(?:90.?day\s+(?:blueprint|plan|roadmap))\b/i,
```

#### 3.7 Files

| File | Action |
|---|---|
| `src/types/documents.ts` | Extend |
| `src/data/govsecurePlaybooks.ts` | Create |
| `src/lib/ai/documentTemplates.ts` | Add playbook phases + TPRM templates |
| `src/lib/ai/multiAgent.ts` | Extend `PlaybookOrchestrator.run()` |
| `src/lib/ai/intentClassifier.ts` | Add 2 framework patterns |

---

### PHASE 3.5 — WorkflowOrchestrator (Multi-Turn Documents) 🔵 NEW

**Objective**: Enable iterative, stateful completion of multi-section documents (TPRM, 90-Day Blueprint progress tracking, future audit workflows).

**Estimated effort**: 5 engineer-days.

#### 3.5.1 Prisma schema migration

```prisma
model WorkflowSession {
  id            String   @id @default(cuid())
  userId        String
  conversationId String?
  workflowType  String   // 'tprm' | '90day-blueprint' | 'risk-assessment'
  status        String   // 'in-progress' | 'paused' | 'completed' | 'abandoned'
  currentSection String?
  state         Json     // { sections: { '1': { questions: { '1.1': { answer: '...', score: 4 } } } } }
  artifactId    String?  // Link to GeneratedArtifact when completed
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  user         User      @relation(fields: [userId], references: [id])
  conversation Conversation? @relation(fields: [conversationId], references: [id])

  @@index([userId, status])
  @@index([conversationId])
}
```

#### 3.5.2 WorkflowOrchestrator

**File**: `src/lib/ai/workflowOrchestrator.ts` *(new)*

```typescript
export interface WorkflowStep {
  sectionId: string;
  question: string;
  responseType: ResponseType;
  options?: string[];
  validation?: (input: unknown) => ValidationResult;
  scoringRubric?: ScoringRubric;
  redFlagCheck?: (answer: unknown) => RedFlag | null;
}

export interface WorkflowState {
  sessionId: string;
  workflowType: string;
  currentStep: number;
  totalSteps: number;
  answers: Record<string, WorkflowAnswer>;
  scores: Record<string, number>;
  redFlags: RedFlag[];
}

export class WorkflowOrchestrator {
  async startSession(userId: string, workflowType: string, context: object): Promise<WorkflowSession>;
  async getNextStep(sessionId: string): Promise<WorkflowStep | null>;
  async submitAnswer(sessionId: string, sectionId: string, answer: unknown): Promise<WorkflowStepResult>;
  async pauseSession(sessionId: string): Promise<void>;
  async resumeSession(sessionId: string): Promise<WorkflowState>;
  async finalize(sessionId: string): Promise<GeneratedArtifact>;  // Generates final document
}
```

#### 3.5.3 TPRM workflow definition

**File**: `src/lib/ai/workflows/tprm.ts` *(new)*

```typescript
import { TPRM_QUESTIONNAIRE } from '@/data/govsecurePlaybooks';

export const TPRM_WORKFLOW: WorkflowDefinition = {
  type: 'tprm',
  steps: TPRM_QUESTIONNAIRE.flatMap(section =>
    section.questions.map(q => ({
      sectionId: `${section.id}.${q.id}`,
      question: q.text,
      responseType: q.responseType,
      scoringRubric: q.scoringRubric,
      redFlagCheck: q.redFlagTrigger ? buildRedFlagFn(q.redFlagTrigger) : undefined,
    }))
  ),
  finalizer: async (state) => {
    // Generate the executive summary, scored sections, red-flag list
    // Output the full TPRM artifact
  },
};
```

#### 3.5.4 API surface

**Files**: `src/app/api/workflows/start/route.ts`, `src/app/api/workflows/[id]/answer/route.ts`, `src/app/api/workflows/[id]/route.ts` *(new)*

- `POST /api/workflows/start` → `{ sessionId, firstStep }`
- `POST /api/workflows/{id}/answer` → `{ nextStep | finalArtifact }`
- `GET /api/workflows/{id}` → current state
- `POST /api/workflows/{id}/pause` → pause session
- `POST /api/workflows/{id}/resume` → resume

#### 3.5.5 UI integration

**File**: `src/components/advisor/WorkflowPanel.tsx` *(new)*

- Step-by-step UI: current question, response input, progress bar, score display, red-flag warnings
- Pause/resume controls
- Final review & export step

When Govi detects intent for TPRM/Blueprint in conversation, it offers: *"This is a multi-section assessment. Would you like to start the guided workflow?"* (button) → switches into `WorkflowPanel`.

#### 3.5.6 Files

| File | Action |
|---|---|
| `prisma/schema.prisma` | Add `WorkflowSession` model |
| `src/lib/ai/workflowOrchestrator.ts` | Create |
| `src/lib/ai/workflows/tprm.ts` | Create |
| `src/lib/ai/workflows/blueprintTracker.ts` | Create |
| `src/types/workflows.ts` | Create |
| `src/app/api/workflows/start/route.ts` | Create |
| `src/app/api/workflows/[id]/answer/route.ts` | Create |
| `src/app/api/workflows/[id]/route.ts` | Create |
| `src/components/advisor/WorkflowPanel.tsx` | Create |

#### 3.5.7 Acceptance criteria

- [ ] User can start TPRM, answer 70+ questions across 12 sections, pause, resume next day, complete, and download branded artifact
- [ ] Red-flag triggers fire in real time and surface in UI
- [ ] Section scores aggregate correctly into executive summary
- [ ] Session state persists across browser refreshes

---

### PHASE 4 — Agent Context Enrichment + RAG Tuning

**Objective**: Surface GovSecure content reliably across the multi-agent pipeline and properly attribute it in responses.

**Estimated effort**: 2 engineer-days.

#### 4.1 Enrich agent contexts

`src/lib/ai/multiAgent.ts` — extend `getAgentFrameworkContext()`:

| Agent | GovSecure additions |
|---|---|
| Risk Assessor (40%) | 4-tier risk model, Risk Assessment Kitchen recipes, auto-high triggers |
| Compliance Expert (30%) | Policy Suite Map (which policies satisfy NIST/EU/ISO/GDPR), regulatory cross-walks |
| Policy Architect (15%) | Full 15-policy structure, AI Chef governance stations, RACI model |
| Strategy Advisor (15%) | 90-Day Blueprint phases, AI Chef operational templates, SMB resource constraints |

All injections sourced from `govsecureKnowledge.ts` constants from Phase 1.

#### 4.2 RAG source labeling

`src/lib/ai/rag.ts` — when formatting `dbSelected` entries, group GovSecure-tagged entries under `"GovSecure Governance Library"` heading. This propagates to the `sources[]` array returned to the UI.

Add structured anchor info to source citations: `"GovSecure AI Chef™ Operating Model — Station 2 (Risk Assessment Kitchen), Recipe #2"` rather than the entry title alone.

#### 4.3 Static keyword KB fallback

`src/lib/ai/knowledgeBase.ts` — add 3 fallback `KnowledgeDocument` entries (AI Chef overview, Policy Suite overview, 90-Day Blueprint overview) so GovSecure content is findable even when pgvector is cold.

#### 4.4 Optional: source-type filtering

In `src/lib/ai/vectorSearch.ts`, if testing reveals GovSecure results being displaced by NIST entries for GovSecure-specific queries, add a heuristic: when query contains GovSecure-trigger terms (*"AI Chef"*, *"90-day"*, *"policy suite"*), boost `sourceType === 'govsecure'` results.

#### 4.5 Files

| File | Action |
|---|---|
| `src/lib/ai/multiAgent.ts` | Extend agent contexts |
| `src/lib/ai/rag.ts` | Label GovSecure sources |
| `src/lib/ai/knowledgeBase.ts` | Add fallback entries |
| `src/lib/ai/vectorSearch.ts` | (Optional) source-type boost |

---

### PHASE 4.5 — Cross-Document Org Consistency 🔵 NEW

**Objective**: Within a conversation session, generated documents share consistent org context (role names, escalation paths, terminology).

**Estimated effort**: 2 engineer-days.

#### 4.5.1 OrgContext extraction

**File**: `src/lib/ai/orgContext.ts` *(new)*

```typescript
export interface OrgContext {
  organizationName?: string;
  industry?: string;
  size?: 'small' | 'medium' | 'large';
  governanceLeadTitle?: string;       // E.g. "VP of Operations"
  escalationPath?: string[];          // E.g. ["Manager", "VP", "CEO"]
  knownAITools?: string[];            // E.g. ["ChatGPT Enterprise", "Microsoft Copilot"]
  riskAppetite?: 'conservative' | 'balanced' | 'aggressive';
  jurisdictions?: string[];           // E.g. ["US", "EU"]
}

export async function extractOrgContext(
  conversationId: string
): Promise<OrgContext>;

export async function updateOrgContext(
  conversationId: string,
  updates: Partial<OrgContext>
): Promise<void>;
```

Stored in `Conversation.metadata` JSON field (add to Prisma if not present).

#### 4.5.2 Wire into orchestrators

When `DocumentOrchestrator`, `PlaybookOrchestrator`, or `WorkflowOrchestrator` runs, fetch `OrgContext` for the conversation and inject into the generation prompt:

```
ORGANIZATION CONTEXT (apply consistently across all documents):
- Organization: HarborCraft Home Goods (280-person ecommerce SMB)
- AI Governance Lead: VP of Operations (Sarah Chen)
- Escalation: Lead → VP → CEO
- Known AI tools: ChatGPT Enterprise, Microsoft Copilot, Zendesk AI
- Jurisdictions: US (multi-state), EU (Germany subsidiary)
```

#### 4.5.3 Conversational extraction

When the user mentions org details, Govi extracts and stores them:

> User: "We're a 200-person fintech in California using Anthropic Claude for customer support."
> Govi: [extracts: industry=fintech, size=medium, jurisdictions=[US-CA], knownAITools=[Anthropic Claude], implied=customer-support-use-case]

#### 4.5.4 Files

| File | Action |
|---|---|
| `src/lib/ai/orgContext.ts` | Create |
| `prisma/schema.prisma` | Add `metadata Json?` to Conversation if not present |
| `src/lib/ai/multiAgent.ts` | Inject OrgContext into orchestrator prompts |
| `src/lib/ai/orchestratorDispatch.ts` | Trigger OrgContext extraction after each turn |

---

### PHASE 5 — Schema Validation

**Objective**: Ensure Zod schemas accept all new types.

**Estimated effort**: 0.5 engineer-days. Done in parallel with Phase 2.

- `src/lib/ai/schemas.ts` — extend `documentType` enum and `framework` enum
- `src/lib/ai/orchestratorDispatch.ts` — verify casts work (no logic change)

---

### PHASE 6 — UI Polish

**Objective**: Surface GovSecure branding and document types in the UI.

**Estimated effort**: 2 engineer-days.

- `src/components/advisor/ActionCardsPanel.tsx` — display names + icons for 22+ new types
- `src/components/advisor/RegulationsPanel.tsx` — GovSecure source badge
- `src/components/advisor/ArtifactViewer.tsx` — correct titles, format download buttons (Phase 2.6)
- `src/components/advisor/WorkflowPanel.tsx` (already in Phase 3.5)
- `src/app/govi/page.tsx` — update tagline from "Powered by GPT-4o" if appropriate, add link to GovSecure Library browse view

---

### PHASE 7 — Token Cost Optimization 🔵 NEW

**Objective**: Keep per-query costs flat or lower despite the larger system prompt and KB.

**Estimated effort**: 2 engineer-days.

#### 7.1 OpenAI prompt caching

The static portion of the system prompt + system-level RAG context is identical across queries. Move to OpenAI prompt cache:

- Restructure prompt so cacheable prefix (~80% of tokens) comes first
- Use `cache_control: { type: "ephemeral" }` markers (when OpenAI supports)
- Expected savings: ~50% on prompt tokens

#### 7.2 Tiered model selection

Not every query needs GPT-4o + 4-agent consensus.

| Query type | Model | Agents |
|---|---|---|
| FAQ-style ("what is NIST AI RMF?") | gpt-4o-mini | 1 (synthesizer only) |
| Standard advisory | GPT-4o | 4 (current) |
| High-stakes generation (policy, blueprint) | GPT-4o | 4 |
| Eval rubric judging | GPT-4o-mini | 1 |

Decision logic in `src/lib/ai/orchestratorDispatch.ts` based on intent + query length + risk markers.

#### 7.3 Aggressive caching

Generated documents with identical inputs should be cached for 24h. Today's `responseCache.ts` is per-query; extend to artifact generation.

#### 7.4 Files

| File | Action |
|---|---|
| `src/lib/ai/systemPrompt.ts` | Restructure for caching |
| `src/lib/ai/orchestratorDispatch.ts` | Tiered model selection |
| `src/lib/responseCache.ts` | Extend to artifacts |

#### 7.5 Acceptance criteria

- [ ] Per-query token cost reduced ≥30% on typical advisory queries
- [ ] Eval pass rate not degraded by tiered model routing

---

## 6. Files Inventory (Master List)

### New files (24 total)

| File | Phase |
|---|---|
| `scripts/ingestGovSecureLibrary.py` | 0 |
| `requirements-extraction.txt` | 0 |
| `src/data/govsecureContent/**/*.json` (~30 files) | 0 |
| `src/data/govsecureContent/_schemas/*.json` | 0 |
| `src/types/govsecure.ts` | 1 |
| `src/data/govsecureKnowledge.ts` | 1 |
| `src/lib/ai/systemPrompt.ts` | 1 (refactor) |
| `src/lib/ai/evals/golden/*.golden.json` (~30) | 1.5 |
| `src/lib/ai/evals/rubric.ts` | 1.5 |
| `src/lib/ai/evals/runner.ts` | 1.5 |
| `src/lib/ai/evals/judge.ts` | 1.5 |
| `.github/workflows/govi-eval.yml` | 1.5 |
| `src/lib/ai/citationValidator.ts` | 1.6 |
| `src/data/govsecurePolicies.ts` | 2 |
| `src/lib/ai/exemplarRetrieval.ts` | 2.5 |
| `src/lib/exporters/govSecureWordExporter.ts` | 2.6 |
| `src/lib/exporters/govSecurePdfExporter.ts` | 2.6 |
| `src/lib/exporters/styles.ts` | 2.6 |
| `src/app/api/artifacts/[id]/download/route.ts` | 2.6 |
| `public/branding/govsecure-wordmark.png` | 2.6 |
| `src/data/govsecurePlaybooks.ts` | 3 |
| `src/types/workflows.ts` | 3.5 |
| `src/lib/ai/workflowOrchestrator.ts` | 3.5 |
| `src/lib/ai/workflows/tprm.ts` | 3.5 |
| `src/lib/ai/workflows/blueprintTracker.ts` | 3.5 |
| `src/app/api/workflows/start/route.ts` | 3.5 |
| `src/app/api/workflows/[id]/answer/route.ts` | 3.5 |
| `src/app/api/workflows/[id]/route.ts` | 3.5 |
| `src/components/advisor/WorkflowPanel.tsx` | 3.5 |
| `src/lib/ai/orgContext.ts` | 4.5 |

### Existing files extended (12 total)

| File | Phases |
|---|---|
| `src/app/api/advisor/route.ts` | 1, 1.6 |
| `src/app/api/advisor/stream/route.ts` | 1, 1.6 |
| `src/lib/knowledge/seedData.ts` | 1 |
| `src/types/documents.ts` | 2, 3 |
| `src/lib/ai/documentTemplates.ts` | 2, 3 |
| `src/lib/ai/intentClassifier.ts` | 2, 3 |
| `src/lib/ai/schemas.ts` | 2, 5 |
| `src/lib/ai/multiAgent.ts` | 2.5, 3, 4, 4.5 |
| `src/lib/ai/rag.ts` | 4 |
| `src/lib/ai/knowledgeBase.ts` | 4 |
| `src/lib/ai/vectorSearch.ts` | 4 (optional) |
| `src/lib/ai/orchestratorDispatch.ts` | 4.5, 7 |
| `src/lib/responseCache.ts` | 7 |
| `src/components/advisor/ActionCardsPanel.tsx` | 6 |
| `src/components/advisor/RegulationsPanel.tsx` | 6 |
| `src/components/advisor/ArtifactViewer.tsx` | 6 |
| `prisma/schema.prisma` | 2.6, 3.5, 4.5 |
| `package.json` | 0, 1.5 |

---

## 7. Sequencing and Dependencies

```
WEEK 1
├── Phase 0 (Extraction Pipeline)            [2-3 days]
└── Phase 1.5 setup (Eval Harness scaffold)  [parallel, 2 days]

WEEK 2
├── Phase 1 (Knowledge Foundation)           [3 days]
├── Phase 1.5 golden cases authoring         [parallel, 2 days]
└── Phase 1.6 (Hallucination Guardrails)     [2 days]

WEEK 3
├── Phase 2 (Policy + Checklist Generation)  [4 days]
└── Phase 5 (Schemas)                        [parallel, 0.5 days]

WEEK 4
├── Phase 2.5 (Exemplar Retrieval)           [2 days]
└── Phase 2.6 (Branded Export)               [3 days]

WEEK 5
├── Phase 3 (Playbook + Blueprint)           [3 days]
└── Phase 4 (Agent Contexts + RAG Tuning)    [parallel, 2 days]

WEEK 6
└── Phase 3.5 (WorkflowOrchestrator)         [5 days]

WEEK 7
├── Phase 4.5 (OrgContext)                   [2 days]
└── Phase 6 (UI Polish)                      [parallel, 2 days]

WEEK 8
├── Phase 7 (Token Optimization)             [2 days]
├── Bug fixes, eval iteration                [3 days]
└── GA release
```

**Critical path**: Phase 0 → 1 → 2 → 3.5. Other phases parallel.

---

## 8. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Extraction pipeline misses subtle formatting in original DOCX | Med | Med | Phase 1.5 eval voiceMatch score catches this; iterate extractor |
| GPT-4o rejects long exemplar prompts (context overflow) | Low | High | Token budget enforcement in `exemplarRetrieval.ts`; truncate intelligently |
| Brand voice still feels generic after Phase 2.5 | Med | High | Increase exemplar count to 3; consider fine-tuning as Phase 8 |
| WorkflowOrchestrator state loss on browser close | Low | High | Server-side persistence via `WorkflowSession` (already designed) |
| TPRM red-flag rules misfire (false positives) | Med | Med | Manual rule tuning during Phase 1.5 golden case authoring |
| Branded `.docx` doesn't render correctly in older Word versions | Low | Med | Test against Word 2016+; PDF fallback always available |
| Eval rubric LLM judge has bias | Med | Med | Use a different model (gpt-4o-mini) for judging vs. generating; periodic human spot-checks |
| Token costs spike with multi-agent + exemplars | High | Med | Phase 7 (caching, tiered models) addresses this |
| Citation validator over-strips legitimate text | Low | Med | Threshold tuning; soft warnings before hard strips |
| GovSecure updates a policy → re-ingestion breaks downstream | Low | Med | JSON Schema validation in Phase 0 catches breaking changes; semver doc codes |

---

## 9. Success Criteria (Definition of Done)

### 9.1 Quantitative

- [ ] Eval harness pass rate ≥ 80% across all golden cases
- [ ] `voiceMatch` average ≥ 0.75 vs. exemplars
- [ ] Hallucinated citations: 0 in production over 30-day rolling window
- [ ] Per-query token cost flat or lower vs. baseline
- [ ] TPRM workflow completion rate ≥ 60% (sessions started → finalized)

### 9.2 Qualitative

- [ ] GovSecure SME review of 10 generated artifacts: ≥8 rated "indistinguishable from our consultant work"
- [ ] Branded `.docx` output passes side-by-side visual comparison with original
- [ ] User can complete TPRM end-to-end without engineer support

### 9.3 Operational

- [ ] Re-ingesting GovSecure library after a content update takes < 30 minutes
- [ ] Eval suite runs on every PR; no regressions merged
- [ ] Documentation in `README.md` and a new `docs/govi-architecture.md` reflects the integrated system

---

## 10. Open Questions for Stakeholders

1. **Asset licensing**: Confirm legal authorization to embed GovSecure brand wordmark and license boilerplate text in generated outputs.
2. **Document codes**: Should generated documents use sequential codes (`GS-AIPS-AUP-{userId}-{n}`) or content-hash codes?
3. **Storage**: For `.docx`/`.pdf` blobs — Prisma BLOB columns vs. S3/R2 + URL persistence? Prefer object storage for scale.
4. **Fine-tuning fallback**: If Phase 2.5 exemplar retrieval doesn't reach 0.75 voiceMatch, is there budget for fine-tuning a custom GPT-4o variant on GovSecure content?
5. **Existing `evidence-pack`**: Confirm the existing type can be safely updated with GovSecure language (vs. introducing a parallel type).
6. **Workflow UX**: For TPRM, prefer a standalone workflow surface (full-page) or inline within the chat UI?
7. **Tier gating**: Which generation features gate behind PRO+? Suggest: AUP free for all, full Policy Suite generation behind PRO, Workflows behind TEAM/ENTERPRISE.

---

## 11. Appendix A — Reference Materials

- `GovSecure Project-20260505T105940Z-3-001/` — source content library (82 files)
- `RECOMMENDATIONS.md` — prior recommendations on system improvements
- `DESIGN_SYSTEM.md` — brand colors, typography, spacing for the UI and exporters
- `README.md` — project overview
- `prisma/schema.prisma` — current data model
- `/home/codespace/.claude/projects/-workspaces-AI-Gov/memory/content_library.md` — auto-memory record of the content library structure

---

## 12. Appendix B — Eval Rubric Detail

### Structure score (0–1)

Counts the percentage of `expectedSections` that appear (case-insensitive substring match) in the generated output's section headings.

### Required clauses score (0–1)

For each `requiredClauses` term, search the full generated text. Score = found / total.

### Voice score (0–1)

LLM judge prompt:
```
Compare these two passages from the same document type.
Passage A is the canonical GovSecure version.
Passage B was AI-generated.

Rate Passage B on 0.0–1.0 for each:
- Tone match (formal, practical, prescriptive)
- Section density (similar word count and detail level)
- Terminology overlap (uses GovSecure-specific terms like "AI Governance Lead", "intake process", "use case")
- Structural style (similar use of bullets, paragraph breaks, headings)

Average the four scores.
```

### Hallucination check (pass/fail)

Run citation validator. Any unverified citation = fail.

### Overall score

`0.30 × structure + 0.30 × clauses + 0.30 × voice + 0.10 × hallucination_pass`

Pass threshold: 0.75.

---

## 13. Appendix C — Sample Extraction Output

For illustration. Real Phase 0 will produce ~30 such files.

```json
// src/data/govsecureContent/policies/ai-governance.json
{
  "documentCode": "GS-AIPS-GOVPOL-01",
  "title": "AI Governance Policy",
  "category": "policy",
  "subType": "governance",
  "sourcePath": "Policies/GovSecure_AI Policy_Suite_Standalaone/govsecure_core8_licensed_final/AI_Governance_Policy_Licensed.docx",
  "extractedAt": "2026-05-05T15:30:00Z",
  "checksum": "sha256:a1b2c3...",
  "metadata": {
    "tier": "Tier 1 — Core Starter Set",
    "version": "Licensed",
    "license": "Internal business use only — restricted from redistribution"
  },
  "sections": [
    {
      "id": "0",
      "heading": "Policy Overview",
      "level": 1,
      "paragraphs": [
        "Practical governance beats vague good intentions.",
        "Use this document as a client-ready policy baseline. Customize named roles, escalation paths, and references to internal standards, classifications, and regulatory obligations before approval."
      ],
      "bullets": []
    },
    {
      "id": "1",
      "heading": "Policy Statements",
      "level": 1,
      "paragraphs": [],
      "bullets": [
        "The enterprise shall maintain a formal AI governance structure with defined ownership, decision rights, escalation paths, and oversight responsibilities.",
        "Every AI system and AI use case shall have an accountable business owner and an identified technical or platform owner.",
        "New AI use cases, major changes, and exceptions shall be reviewed through the enterprise AI intake and risk assessment process before approval.",
        "The AI Governance Lead shall maintain the AI system inventory, governance standards, review cadence, and reporting to leadership.",
        "High-risk or sensitive AI use cases shall receive enhanced review involving Security, Privacy, Legal, and relevant business stakeholders before deployment.",
        "The enterprise shall review AI risks, control gaps, incidents, and exceptions on a periodic basis and track remediation to closure.",
        "No AI initiative may bypass required governance merely because the capability is bundled into an existing SaaS product or business workflow."
      ]
    },
    {
      "id": "2",
      "heading": "Roles and Responsibilities",
      "level": 1,
      "paragraphs": [],
      "bullets": [
        "Executive Sponsor provides direction, resolves escalations, and approves material risk decisions.",
        "AI Governance Lead runs the intake process, inventory, review cadence, and governance reporting.",
        "Business owners are accountable for approved use cases, outcomes, and operational controls.",
        "Security, Privacy, Legal, IT, and Procurement support reviews based on risk tier and change impact."
      ]
    }
  ],
  "boilerplate": {
    "implementationNote": "This policy should be approved by the client's designated owner, linked to operating procedures, and reviewed at least annually or after a material AI-related change.",
    "license": "License Scope: This document is licensed for internal business use by the purchasing organization and its controlled affiliates unless otherwise agreed in writing.",
    "footerCode": "GS-AIPS-GOVPOL-01"
  }
}
```

---

**Document End — GOVI-GS-INTEG-V1**
