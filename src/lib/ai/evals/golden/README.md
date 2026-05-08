# Govi Eval Golden Cases

Each `*.golden.json` file describes one case that the eval runner executes against the matching orchestrator (or that is reported as `skipped` if the orchestrator does not yet exist — Phase 2 doc types are authored here in advance so the corpus activates the moment Phase 2 ships).

Schema is defined in `../types.ts`. Run with:

```bash
npm run eval:govi              # full suite (uses OpenAI)
EVAL_MOCK=1 npm run eval:govi  # mock orchestrators — used by CI for shape checks
```

Reports are written to `evals/reports/{timestamp}.json` at the repo root.

## Coverage

| Category               | Count | Notes                                                                 |
|------------------------|-------|-----------------------------------------------------------------------|
| `document-generation`  | 13    | 8 GovSecure policies + 5 existing doc types (use-case-summary, dpia…) |
| `intake`               | 4     | Spans Low/Medium/High/Critical (prohibited)                           |
| `playbook`             | 4     | NIST AI RMF, EU AI Act, ISO/IEC 42001, Combined                       |
| `advisory-query`       | 9     | GovSecure methodology probes + hallucination tripwires                |
| **Total**              | **30**|                                                                       |

## Authoring a new case

1. Pick a unique `id` slug.
2. Set `category` to one of `document-generation` | `intake` | `playbook` | `advisory-query`.
3. Fill `requiredClauses` with substrings that MUST appear in the rendered output (case-insensitive).
4. Fill `forbiddenContent` with substrings that MUST NOT appear — used to catch fabricated citations / wrong terminology.
5. For `document-generation`, fill `expectedSections` with section heading fragments.
6. Optionally set `exemplarPath` (relative to repo root) to enable the LLM judge's voice match.

The pass threshold is `0.8` overall AND deterministic hallucination check must pass. See `../rubric.ts`.
