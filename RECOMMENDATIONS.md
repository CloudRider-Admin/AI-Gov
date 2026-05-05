# AI Gov Project — Comprehensive Recommendations & Priority Updates

**Project:** AI Governance Platform (GovSecure)  
**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript 5, Prisma 6, PostgreSQL, OpenAI GPT-4o, TailwindCSS  
**Last updated:** 2026-04-23

---

## 🔴 CRITICAL PRIORITY

### 1. **Prisma 6 Migration — Type Safety Fragile**
**Issue:** `scripts/fix-prisma-types.js` hacks around Prisma 6's broken type exports. This is a temporary workaround, not a solution.

**Recommendations:**
- **Monitor Prisma releases** — this bug should be fixed upstream. Remove the hack once fixed.
- **Add type-safe wrapper** around Prisma client to catch future breakage:
  ```typescript
  // src/lib/prisma.ts
  export const prisma = new PrismaClient({
    log: ['error', 'warn'],
  }) as unknown as PrismaClient & {
    $transaction: <T>(fn: (tx: PrismaClient) => Promise<T>, options?: any) => Promise<T>;
  };
  ```
- **Run `prisma generate` in CI** and fail early if type declarations are missing.

### 2. **Missing Environment Variable Validation in Production**
**Issue:** `src/lib/env.ts` validates at import time, but the import chain goes through `prisma.ts` → `@prisma/client`, which may load before env validation in some edge cases.

**Fix:**
```typescript
// src/middleware.ts — already imports env indirectly via auth
// Ensure env is imported FIRST in next.config.js and middleware.ts
// Add explicit import at top of next.config.js:
import '@/lib/env'; // Fail fast on startup
```

### 3. **Token Budget Reset Logic Missing**
**Issue:** `tokenBudget.ts` uses calendar month resets but there's no background job to clear old records or reset budgets. Accumulating `TokenUsage` rows will bloat the DB.

**Fix:**
- Add a cron job (Vercel Cron, Supabase pg_cron, or similar) to:
  - Delete `TokenUsage` older than 90 days
  - Optionally archive to cold storage
- Add a `budgetResetAt` field on `User` to track when their monthly budget refreshes (for pro-rated upgrades)

---

## 🟠 HIGH PRIORITY

### 4. **Rate Limiting — IP-based Guest Limits Can Be Bypassed**
**Issue:** Guest rate limiting uses `guest:${ip}` which is spoofable via `X-Forwarded-For`. Behind proxies (Vercel, Cloudflare), you must trust `X-Forwarded-For` from the provider only.

**Fix:**
```typescript
// src/lib/rate-limit.ts
import { NextRequest } from 'next/server';

function getClientIp(request: NextRequest): string {
  // Vercel: X-Vercel-Client-Ip is reliable
  // Cloudflare: Cf-Connecting-Ip
  // Fallback: X-Forwarded-For first segment
  const vercelIp = request.headers.get('x-vercel-client-ip');
  if (vercelIp) return vercelIp;
  
  const cfIp = request.headers.get('cf-connecting-ip');
  if (cfIp) return cfIp;
  
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  
  return 'unknown';
}
```

### 5. **Circuit Breaker Should Be Per-User/Endpoint, Not Global**
**Issue:** `openaiCircuit` is a singleton. One user's spam can trip the circuit for all users.

**Fix:**
```typescript
// Create per-user circuit map with cleanup
const circuitMap = new Map<string, CircuitBreaker>();

function getCircuitFor(userId: string): CircuitBreaker {
  const key = `user:${userId}`;
  if (!circuitMap.has(key)) {
    circuitMap.set(key, new CircuitBreaker({ failureThreshold: 3, cooldownMs: 30_000 }));
  }
  return circuitMap.get(key)!;
}
```
Or at minimum, separate by endpoint (`advisor`, `advisor/stream`, `documents`, etc.).

### 6. **Stream Buffer Memory Leak Risk**
**Issue:** `streamBuffer` (in-memory) never expires old entries. Memory grows unbounded under load.

**Fix:**
```typescript
// src/lib/streamBuffer.ts — add TTL + periodic cleanup
const BUFFER_TTL_MS = 5 * 60 * 1000; // 5 minutes

setInterval(() => {
  streamBuffer.prune(); // Remove entries older than TTL
}, 60_000);
```

### 7. **No Input Sanitization on User Name/Fields**
**Issue:** `User.name` from OAuth providers or manual signup can contain malicious Unicode, XSS payloads stored in DB.

**Fix:**
```typescript
import sanitizeHtml from 'sanitize-html';

// In registration flow
user.name = sanitizeHtml(user.name, { allowedTags: [], allowedAttributes: {} });
```
Add DOMPurify on client-side display as well.

### 8. **Conversation History Missing Pagination**
**Issue:** `GET /api/conversations` fetches 50 most recent, but the UI `Advisor` loads all history into memory on session start. Large histories (>100 convos) will OOM the client.

**Fix:**
- Paginate API: `?limit=20&offset=0`
- Virtualize `ConversationHistory` list with `react-window` or `react-virtual`
- Lazy-load older conversations on scroll

### 9. **Orchestrator Dispatch Error Handling Too Broad**
**Issue:** `dispatchOrchestrator.ts:147` catches all errors and returns `orchestratorError` but still returns `undefined` artifact. Some errors (DB failures, validation) should 500 immediately.

**Fix:**
```typescript
} catch (err) {
  console.error('[orchestratorDispatch] Failed:', err);
  
  // Non-retryable fatal errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    throw err; // 500
  }
  
  // Retryable: network, rate limits, timeouts
  const isRetryable = /429|timeout|ECONNRESET/.test(errorMessage);
  // ...
}
```

---

## 🟡 MEDIUM PRIORITY

### 10. **TypeScript — `any` Leaks in Multi-Agent Pipeline**
**Issue:** `multiAgent.ts:346` and `orchestratorDispatch.ts:148` use `any` or unsafe casts.

**Fix:**
```typescript
// Add strict typing
const errorMessage = err instanceof Error ? err.message : 'Unknown error';
// → switch to error mapping
type KnownError = { message: string; code?: string };
function isKnownError(e: unknown): e is KnownError {
  return typeof e === 'object' && e !== null && 'message' in e;
}
```

### 11. **Missing API Response Validation Schemas**
**Issue:** All API routes return inline JSON without Zod validation of response shape.

**Fix:**
```typescript
import { z } from 'zod';

const AdvisorResponseSchema = z.object({
  mode: z.enum(['assessment', 'clarification']).optional(),
  riskProfile: z.object({
    level: z.enum(['low', 'medium', 'high', 'critical']),
    confidence: z.number(),
    // ...
  }),
  // ...
});

// In route handler:
const validated = AdvisorResponseSchema.parse(finalResponse);
return NextResponse.json(validated);
```

### 12. **RAG — Vector Search Not Fallback-Proof**
**Issue:** `rag.ts:75` silently ignores vector search failures. If pgvector is down, users get degraded results without notification.

**Fix:**
```typescript
const vectorAvailable = await isVectorSearchAvailable();
if (!vectorAvailable) {
  auditLog({ event: 'rag.vector_unavailable', data: { userId, endpoint } });
}
```
Optionally surface a subtle UI indicator: "semantic search unavailable — using keyword results"

### 13. **Caching — Single Advisor Cache Instance Shared Across All Users**
**Issue:** `advisorCache` is global. User A's query could hit User B's cached response if `conversationId` collides (low probability but possible).

**Fix:**
Keys already include conversationId and role — safe for now. But consider namespacing by `userId` for authenticated users to prevent any cross-contamination.

### 14. **Dashboard Widget — Mock Data Flow**
**Issue:** `DashboardContent.tsx:424–447` shows "Global Data Flow" with hardcoded status. This is placeholder UI.

**Fix:**
Either connect to real monitoring (Healthchecks.io, Grafana, etc.) or remove the widget and replace with "System Status: Nominal" summary.

---

## 🟢 LOW PRIORITY / QUALITY OF LIFE

### 15. **Documentation — Missing API Contract Docs**
**Issue:** No OpenAPI/Swagger spec for the 15+ API endpoints.

**Fix:**
- Use `@vercel/otel` or `zod-to-openapi` to auto-generate OpenAPI JSON from Zod schemas.
- Serve at `/.well-known/api-docs` or use Scalar/Stoplight Elements UI.

### 16. **Test Coverage Gaps**
**Current:** Vitest configured with coverage on `src/lib/ai/` only.

**Missing Coverage:**
- `src/lib/circuitBreaker.ts` — only unit tested, no integration with OpenAI mock
- `src/lib/rate-limit.ts` — no tests for transaction race conditions
- `src/middleware.ts` — no route guard tests
- `src/app/api/*/route.ts` — no request/response round-trip tests

**Recommendation:**
```bash
# Increase coverage thresholds
# vitest.config.ts:
coverage: {
  include: ['src/**'],
  thresholds: { lines: 70, functions: 70, branches: 50 }
}
```

### 17. **Upgrade ESLint from Deprecated `next lint`**
**Issue:** `package.json` uses `next lint` which is deprecated in Next.js 15.

**Fix:**
```bash
npx @next/codemod@canary next-lint-to-eslint-cli .
```
Then update `package.json`:
```json
"scripts": {
  "lint": "eslint . --ext .ts,.tsx"
}
```

### 18. **Dependency Updates Available**
**Partial list from `npm list`:**
- `@sanity/client@7.16.0` → latest `^7.13.2` is fine
- `next@15.5.12` → check for `15.6.x` or `16.0.0` RC
- `react@19.2.4` → Check for `19.2.5` or `19.3.0` patches
- `openai@4.28.0` → `4.67.x` available (adds latest models)
- `resend@6.9.3` → `^5.0.1` (major version bump, breaking changes)

**Recommendation:** Create a `deps.md` tracking approved versions. Upgrade one major version at a time with full regression testing.

### 19. **Missing Error Boundary for API Routes**
**Issue:** `src/app/api/advisor/route.ts` has try/catch but returns generic errors. No structured error logging service (Sentry, LogRocket).

**Fix:**
- Add `@sentry/nextjs` or similar
- Structured error IDs: `ERR:ADVISOR:VALIDATION`, `ERR:ORCHESTRATOR:TIMEOUT`
- Client receives `{ error, code, requestId }` for support

### 20. **Telemetry Gap — No Performance Monitoring**
**Issue:** `auditLog` writes to console only. No RUM (Real User Monitoring) or APM.

**Fix:**
- Add `@vercel/analytics` (already present in Next.js 15 default)
- Add `web-vitals` reporting:
```typescript
// src/lib/utils/web-vitals.ts
export const reportWebVitals = (metric: any) => {
  fetch('/api/analytics/vitals', {
    method: 'POST',
    body: JSON.stringify(metric)
  });
};
```
- Hook into `<Providers>` for SPA navigation timing

---

## 🛠️ ARCHITECTURE IMPROVEMENTS

### 21. **Consider Moving Multi-Agent Orchestration to a Worker Queue**
**Current:** All agent calls happen inline in the request thread (up to 8s timeout).

**Issue:** High latency, no retry queue, blocks serverless function.

**Future:** Use a job queue:
- **Option A:** Vercel Queue, Upstash Queue, or AWS SQS
- **Option B:** Background job in same process with `setTimeout` + status polling
- Decouple artifact generation from immediate response → return `jobId`, poll `/api/jobs/:id`

### 22. **Knowledge Entries — Add Embedding Refresh Job**
**Issue:** `KnowledgeEntry` has `embedding` column but no code updates it. `rag.ts` uses keyword search only.

**Fix:**
```typescript
// scripts/update-embeddings.ts
// Fetch all active entries
// Call OpenAI embeddings API
// Upsert to DB
// Schedule monthly
```

Enable vector search fallback only when embeddings populated.

### 23. **Stripe Webhook — Missing Signature Verification Retry Logic**
**Issue:** `src/app/api/webhooks/route.ts` (not reviewed) likely misses retry handling. Stripe retries failed webhooks with exponential backoff; ensure idempotency.

**Fix:**
- Use `stripe.webhooks.constructEvent` with `apiKey`
- Store webhook `id` to prevent double-processing
- Return `200` within 2s even if async work continues

### 24. **Security — Add Content Security Policy (CSP)**
**Issue:** No CSP headers. XSS risk if any markdown rendering escapes incorrectly.

**Fix:**
```typescript
// next.config.js
headers: async () => [
  {
    source: '/(.*)',
    headers: [
      { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self' 'unsafe-eval' https://cdn.sanity.io; style-src 'self' 'unsafe-inline';" }
    ]
  }
]
```
Note: Tailwind needs `unsafe-inline` for JIT; consider using `nonce` for stricter policy.

---

## 📊 DATABASE / PRISMA

### 25. **Missing Indexes for Query Performance**
Schema looks good (`@@index` present), but add:
```prisma
model Conversation {
  // ...
  @@index([userId, updatedAt]) // already exists ✓
  @@index([createdAt]) // add for admin analytics queries
}

model TokenUsage {
  @@index([createdAt]) // for monthly rollups
}

model Message {
  @@index([conversationId, createdAt DESC]) // already exists ✓
}
```

### 26. **Soft-Deletes Instead of Hard-Deletes**
**Issue:** `prisma.conversation.delete()` is irreversible.

**Fix:**
```prisma
model Conversation {
  deletedAt DateTime?
  // ...
  @@map("conversations")
}
```
Filter `deletedAt: null` in all queries. Add `restore` endpoint.

### 27. **Potential N+1 in DashboardContent**
`DashboardContent.tsx:336` loads conversations then individually renders. Each conversation message count is pre-aggregated (`_count`), good. But any message fetch later (`/api/conversations/[id]`) will be N+1 if listing 50 convos.

**Fix:** Use `Prisma.$transaction` to batch fetch all needed conversation data in one call.

---

## 🎨 FRONTEND / UX

### 28. **Advisor Component — 700+ LoC, Needs Splitting**
`Advisor.tsx` is a monolithic 702-line component. Extract:
- `AdvisorChatArea` (messages + streaming)
- `AdvisorSidebar` (conversation history)
- `AdvisorInputArea` (input + starter prompts)
- `AdvisorErrorBoundary` (already separate)

Improves testability and reduces re-renders.

### 29. **No Skeleton States for Dashboard Cards**
`DashboardContent` shows loading spinner only. Replace with skeleton cards matching final layout.

### 30. **Theme Context — Unused `light` Mode**
`ThemeContext.tsx` supports light/dark but design system is dark-only. Consider removing `light` mode to reduce CSS bundle.

---

## 📝 DOCUMENTATION

### 31. **Missing ADR (Architecture Decision Records)**
Create `docs/adr/` folder:
- `001-multi-agent-orchestrator.md`
- `002-rag-hybrid-search.md`
- `003-rate-limiting-strategy.md`
- `004-streaming-recovery.md`

### 32. **API Documentation Out of Date**
`README.md` mentions outdated endpoints (`/api/advisor/stream` exists ✓). Add full API reference.

### 33. **Deployment Guide Missing**
`docs/DEPLOYMENT.md` referenced but not found. Create with:
- Environment variables list (with defaults)
- Database migration steps
- Vercel/Node/Postgres versions
- CI/CD pipeline steps
- Monitoring/alerting setup

### 34. **Security Policy Missing**
Add `SECURITY.md`:
- How to report vulnerabilities
- Responsible disclosure timeline
- Security audit schedule

---n