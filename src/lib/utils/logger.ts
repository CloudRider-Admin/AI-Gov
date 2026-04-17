export type LogEvent = 'request.received' | 'openai.completed' | 'response.validated' | 'response.fallback' | 'request.failed' | 'artifact.generated' | 'cache.hit' | 'circuit.open' | 'token.budget_exceeded' | 'orchestrator.error' | 'security.injection_detected';

interface LogOptions {
  event: LogEvent;
  data: Record<string, unknown>;
}

const REDACT_PATTERNS = [/api[_-]?key/gi, /token/gi, /secret/gi];

function sanitize(value: unknown): unknown {
  if (typeof value === 'string') {
    let sanitized = value;
    REDACT_PATTERNS.forEach(pattern => {
      sanitized = sanitized.replace(pattern, '[REDACTED]');
    });
    return sanitized.slice(0, 500);
  }

  if (Array.isArray(value)) {
    return value.slice(0, 5).map(sanitize);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, val]) => [key, sanitize(val)])
    );
  }

  return value;
}

export function auditLog({ event, data }: LogOptions) {
  const timestamp = new Date().toISOString();
  const sanitizedData = sanitize(data);
  console.log(`AI-Advisor | ${timestamp} | ${event}`, sanitizedData);
}
