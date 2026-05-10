/**
 * Anthropic Claude fallback for the advisor surface.
 *
 * Triggered when the primary OpenAI path fails with a quota/rate-limit
 * error or when the OpenAI circuit breaker is open. Uses the Anthropic
 * Messages API over `fetch` so no extra SDK dependency is needed.
 *
 * The advisor expects a JSON object as the response, so the system
 * prompt is strengthened with an explicit "JSON only" instruction and
 * the helper extracts the JSON payload out of any prose/code-fence
 * wrapping Claude may emit.
 */

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const DEFAULT_CLAUDE_MODEL = 'claude-sonnet-4-6';

const JSON_ONLY_SUFFIX = `

OUTPUT FORMAT — STRICT:
- Your entire response MUST be a single valid JSON object.
- Start with the opening brace { as the very first character.
- End with the matching closing brace } as the very last character.
- Do NOT wrap the JSON in markdown code fences (no \`\`\`json, no \`\`\`).
- Do NOT include any prose, preamble, or commentary before or after the JSON.
- Do NOT include trailing commas. All strings must be properly escaped.`;

export interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ClaudeRequestOptions {
  system: string;
  messages: ClaudeMessage[];
  maxTokens?: number;
  temperature?: number;
  /** When true, append a JSON-only instruction and extract JSON from the reply. */
  jsonOnly?: boolean;
}

export interface ClaudeCompletion {
  content: string;
  model: string;
  usage: { input_tokens: number; output_tokens: number };
}

function getClaudeModel(): string {
  return process.env.ANTHROPIC_MODEL || DEFAULT_CLAUDE_MODEL;
}

function buildSystem(system: string, jsonOnly: boolean): string {
  return jsonOnly ? `${system}${JSON_ONLY_SUFFIX}` : system;
}

/** Pull the first {...} block out of a Claude reply, stripping fences if present. */
export function extractJsonObject(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fenced) return fenced[1].trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end > start) return text.slice(start, end + 1);
  return text.trim();
}

/** Detect OpenAI quota / rate-limit errors that should trigger a fallback. */
export function isOpenAIQuotaError(error: unknown): boolean {
  const msg = (error instanceof Error ? error.message : String(error)).toLowerCase();
  return (
    msg.includes('429') ||
    msg.includes('quota') ||
    msg.includes('rate_limit') ||
    msg.includes('rate limit') ||
    msg.includes('insufficient_quota')
  );
}

export function isClaudeFallbackAvailable(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

/** Non-streaming Claude call. */
export async function claudeComplete(opts: ClaudeRequestOptions): Promise<ClaudeCompletion> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');
  const model = getClaudeModel();
  const jsonOnly = !!opts.jsonOnly;

  const res = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: opts.maxTokens ?? 4000,
      temperature: opts.temperature ?? 0.3,
      system: buildSystem(opts.system, jsonOnly),
      messages: opts.messages,
    }),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`Anthropic API error ${res.status}: ${errBody.slice(0, 500)}`);
  }

  const data = (await res.json()) as {
    content?: Array<{ type: string; text?: string }>;
    model?: string;
    usage?: { input_tokens?: number; output_tokens?: number };
  };

  const rawText = (data.content ?? [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text ?? '')
    .join('');

  return {
    content: jsonOnly ? extractJsonObject(rawText) : rawText,
    model: data.model ?? model,
    usage: {
      input_tokens: data.usage?.input_tokens ?? 0,
      output_tokens: data.usage?.output_tokens ?? 0,
    },
  };
}

/**
 * Streaming Claude call. Yields incremental text deltas. For `jsonOnly`
 * requests the deltas are still streamed as-is — JSON extraction happens
 * at the call site once the stream completes (since the route accumulates
 * the full payload before parsing).
 */
export async function* claudeStream(opts: ClaudeRequestOptions): AsyncGenerator<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');
  const model = getClaudeModel();
  const jsonOnly = !!opts.jsonOnly;

  const res = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
      'content-type': 'application/json',
      accept: 'text/event-stream',
    },
    body: JSON.stringify({
      model,
      max_tokens: opts.maxTokens ?? 4000,
      temperature: opts.temperature ?? 0.3,
      system: buildSystem(opts.system, jsonOnly),
      messages: opts.messages,
      stream: true,
    }),
  });

  if (!res.ok || !res.body) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`Anthropic API error ${res.status}: ${errBody.slice(0, 500)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let totalText = 0;
  let stopReason: string | undefined;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const events = buffer.split('\n\n');
    buffer = events.pop() ?? '';

    for (const event of events) {
      let dataLine = '';
      for (const line of event.split('\n')) {
        if (line.startsWith('data:')) dataLine = line.slice(5).trim();
      }
      if (!dataLine || dataLine === '[DONE]') continue;
      let parsed: {
        type?: string;
        delta?: { type?: string; text?: string; stop_reason?: string };
        error?: { type?: string; message?: string };
        message?: { stop_reason?: string };
      };
      try {
        parsed = JSON.parse(dataLine);
      } catch {
        continue; // ignore malformed SSE events
      }

      // Surface error events instead of silently dropping them — these are
      // how Anthropic reports overload, invalid request, or billing issues
      // mid-stream after a 200 OK header.
      if (parsed.type === 'error' && parsed.error) {
        throw new Error(
          `Anthropic stream error (${parsed.error.type ?? 'unknown'}): ${parsed.error.message ?? 'no message'}`,
        );
      }

      if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
        if (parsed.delta.text) {
          totalText += parsed.delta.text.length;
          yield parsed.delta.text;
        }
      }
      if (parsed.type === 'message_delta' && parsed.delta?.stop_reason) {
        stopReason = parsed.delta.stop_reason;
      }
    }
  }

  if (totalText === 0) {
    throw new Error(
      `Anthropic stream returned no text (stop_reason=${stopReason ?? 'unknown'}, model=${model})`,
    );
  }
}
