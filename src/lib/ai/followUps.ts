/**
 * Follow-up question normalization, shared by the server parser and the
 * client (which re-reads raw stored assistant JSON when a chat is reopened).
 * Keep this module dependency-free so it is safe to import client-side.
 */
import type { FollowUpChoice } from '@/types/advisor';

const MAX_CHOICES = 5;
/** The UI always adds its own free-text row, so drop model-supplied catch-alls. */
const CATCH_ALL_OPTION = /^(other|others|something else|none of the above)\s*(\(.*\))?[\s.…:]*$/i;

/**
 * The model may return follow-up questions as objects
 * (`{ question, options, multiSelect }`) so the UI can offer clickable
 * answers. Flatten them back to `followUpQuestions: string[]` — which every
 * consumer expects — and carry the options in the index-aligned
 * `followUpChoices` array. Plain string questions get `null` (free text).
 */
export function splitFollowUpChoices<T extends object>(data: T): T {
  const raw = (data as Record<string, unknown>).followUpQuestions;
  if (!Array.isArray(raw)) return data;
  // Already normalized (string questions + aligned choices): leave as is.
  if (raw.every((q) => typeof q === 'string') && Array.isArray((data as Record<string, unknown>).followUpChoices)) return data;
  const questions: string[] = [];
  const choices: (FollowUpChoice | null)[] = [];
  for (const item of raw as unknown[]) {
    if (typeof item === 'string') {
      if (item.trim()) {
        questions.push(item.trim());
        choices.push(null);
      }
      continue;
    }
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    const text = [obj.question, obj.text, obj.prompt].find((v) => typeof v === 'string' && v.trim()) as
      | string
      | undefined;
    if (!text) continue;
    const options = Array.isArray(obj.options)
      ? Array.from(
          new Set(
            (obj.options as unknown[])
              .map((o) => (typeof o === 'string' ? o : (o as Record<string, unknown> | null)?.label))
              .filter((o): o is string => typeof o === 'string' && o.trim().length > 0)
              .map((o) => o.trim())
              .filter((o) => !CATCH_ALL_OPTION.test(o)),
          ),
        ).slice(0, MAX_CHOICES)
      : [];
    questions.push(text.trim());
    choices.push(options.length >= 2 ? { options, multiSelect: obj.multiSelect === true } : null);
  }
  const out: Record<string, unknown> = { ...data, followUpQuestions: questions };
  if (choices.some((c) => c !== null)) out.followUpChoices = choices;
  else delete out.followUpChoices;
  return out as T;
}
