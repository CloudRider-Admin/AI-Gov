/**
 * Normalizes evaluation evidence from whatever shape the AI platform in use
 * exported it in, onto the core evaluation parameters.
 *
 * Three intake paths, one normalizer:
 *   • upload — a JSON or CSV export dropped into GovSecure
 *   • manual — rows typed into the Gate 2 form
 *   • api    — a harness POSTing results after each run
 *
 * The parser is deliberately forgiving about field names (eval tooling has no
 * shared vocabulary) and deliberately strict about what it will invent: a row
 * whose area cannot be resolved is reported as unmapped rather than guessed
 * into the wrong bucket, because a misfiled safety result is worse than a
 * missing one.
 *
 * Client-safe: pure parsing, no database or network access.
 */

import { resolveArea, type EvaluationArea, type MetricUnit } from './coreEvaluationParameters';

export interface NormalizedResult {
  area: EvaluationArea;
  parameter: string;
  metricValue: number | null;
  unit: MetricUnit | null;
  textValue: string | null;
  method: string | null;
  sampleSize: number | null;
  evidenceUrl: string | null;
}

export interface UnmappedRow {
  /** The label we could not resolve to a core review area. */
  label: string;
  raw: Record<string, unknown>;
}

export interface IngestionOutcome {
  results: NormalizedResult[];
  unmapped: UnmappedRow[];
  /** Non-fatal problems worth showing the user (bad numbers, empty rows). */
  warnings: string[];
}

// Field-name candidates, in priority order. Matched case-insensitively with
// non-alphanumerics stripped, so "Review Area", "review_area" and "reviewArea"
// all hit the same entry.
const AREA_FIELDS = ['area', 'reviewarea', 'category', 'dimension', 'evaluationarea', 'test', 'suite'];
const PARAMETER_FIELDS = ['parameter', 'metric', 'name', 'check', 'testname', 'criterion', 'measure'];
const VALUE_FIELDS = ['value', 'metricvalue', 'score', 'result', 'rate', 'measurement'];
const UNIT_FIELDS = ['unit', 'units'];
const TEXT_FIELDS = ['observation', 'notes', 'note', 'comment', 'comments', 'summary', 'finding', 'details', 'textvalue'];
const METHOD_FIELDS = ['method', 'methodology', 'technique', 'harness', 'approach'];
const SAMPLE_FIELDS = ['samplesize', 'n', 'samples', 'count', 'cases', 'numcases'];
const URL_FIELDS = ['evidenceurl', 'url', 'link', 'report', 'artifact', 'href'];

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Index a row by normalized key so lookups tolerate any casing convention. */
function indexRow(row: Record<string, unknown>): Map<string, unknown> {
  const map = new Map<string, unknown>();
  for (const [key, value] of Object.entries(row)) {
    map.set(normalizeKey(key), value);
  }
  return map;
}

function pick(index: Map<string, unknown>, candidates: string[]): unknown {
  for (const candidate of candidates) {
    const value = index.get(candidate);
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return undefined;
}

function asString(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text === '' ? null : text;
}

/**
 * Parses a numeric result, tolerating the formats eval exports actually use:
 * `0.93`, `"93%"`, `"4.2 / 5"`, `"1,024"`. Returns the value alongside any unit
 * the format itself implies.
 */
export function parseMetric(value: unknown): { value: number | null; impliedUnit: MetricUnit | null } {
  if (typeof value === 'number') {
    return { value: Number.isFinite(value) ? value : null, impliedUnit: null };
  }
  const text = asString(value);
  if (!text) return { value: null, impliedUnit: null };

  // Booleans show up in pass/fail columns; treat them as counts of failures.
  if (/^(true|pass(ed)?|yes|ok)$/i.test(text)) return { value: 0, impliedUnit: 'count' };
  if (/^(false|fail(ed)?|no)$/i.test(text)) return { value: 1, impliedUnit: 'count' };

  const percent = text.match(/^([+-]?[\d,]*\.?\d+)\s*%$/);
  if (percent) {
    const parsed = Number(percent[1].replace(/,/g, ''));
    return { value: Number.isFinite(parsed) ? parsed : null, impliedUnit: 'percent' };
  }

  const outOfFive = text.match(/^([+-]?[\d,]*\.?\d+)\s*\/\s*5$/);
  if (outOfFive) {
    const parsed = Number(outOfFive[1].replace(/,/g, ''));
    return { value: Number.isFinite(parsed) ? parsed : null, impliedUnit: 'score-5' };
  }

  const millis = text.match(/^([+-]?[\d,]*\.?\d+)\s*ms$/i);
  if (millis) {
    const parsed = Number(millis[1].replace(/,/g, ''));
    return { value: Number.isFinite(parsed) ? parsed : null, impliedUnit: 'ms' };
  }

  const plain = text.match(/^([+-]?[\d,]*\.?\d+)$/);
  if (plain) {
    const parsed = Number(plain[1].replace(/,/g, ''));
    return { value: Number.isFinite(parsed) ? parsed : null, impliedUnit: null };
  }

  return { value: null, impliedUnit: null };
}

const VALID_UNITS: MetricUnit[] = ['percent', 'score-5', 'count', 'ms', 'ratio'];

function coerceUnit(value: unknown): MetricUnit | null {
  const text = asString(value);
  if (!text) return null;
  const key = normalizeKey(text);
  if (key === 'percent' || key === 'pct' || key === 'percentage' || key === '%') return 'percent';
  if (key === 'score5' || key === 'outof5' || key === 'rating') return 'score-5';
  if (key === 'ms' || key === 'milliseconds' || key === 'millis') return 'ms';
  if (key === 'ratio' || key === 'fraction' || key === 'proportion') return 'ratio';
  if (key === 'count' || key === 'n' || key === 'number' || key === 'violations') return 'count';
  return VALID_UNITS.includes(text as MetricUnit) ? (text as MetricUnit) : null;
}

/**
 * Normalize one row. `fallbackArea` lets a caller that already knows the area
 * (e.g. a JSON export grouped by area) skip per-row area resolution.
 */
export function normalizeRow(
  row: Record<string, unknown>,
  fallbackArea?: string,
): { result: NormalizedResult } | { unmapped: UnmappedRow } | { skipped: string } {
  const index = indexRow(row);

  const rawArea = asString(pick(index, AREA_FIELDS)) ?? fallbackArea ?? null;
  const rawParameter = asString(pick(index, PARAMETER_FIELDS));

  // Resolve from the explicit area first, then fall back to the parameter name:
  // exports often carry only "hallucination_rate" with no area column at all.
  const area = (rawArea ? resolveArea(rawArea) : undefined) ?? (rawParameter ? resolveArea(rawParameter) : undefined);

  const metric = parseMetric(pick(index, VALUE_FIELDS));
  const textValue = asString(pick(index, TEXT_FIELDS));

  if (metric.value === null && !textValue) {
    return { skipped: rawParameter ?? rawArea ?? 'unnamed row' };
  }

  if (!area) {
    return { unmapped: { label: rawArea ?? rawParameter ?? 'unnamed row', raw: row } };
  }

  const sampleRaw = parseMetric(pick(index, SAMPLE_FIELDS));

  return {
    result: {
      area,
      parameter: rawParameter ?? rawArea ?? area,
      metricValue: metric.value,
      unit: coerceUnit(pick(index, UNIT_FIELDS)) ?? metric.impliedUnit,
      textValue,
      method: asString(pick(index, METHOD_FIELDS)),
      sampleSize: sampleRaw.value !== null ? Math.round(sampleRaw.value) : null,
      evidenceUrl: asString(pick(index, URL_FIELDS)),
    },
  };
}

function collect(
  rows: { row: Record<string, unknown>; fallbackArea?: string }[],
): IngestionOutcome {
  const results: NormalizedResult[] = [];
  const unmapped: UnmappedRow[] = [];
  const skipped: string[] = [];

  for (const { row, fallbackArea } of rows) {
    const outcome = normalizeRow(row, fallbackArea);
    if ('result' in outcome) results.push(outcome.result);
    else if ('unmapped' in outcome) unmapped.push(outcome.unmapped);
    else skipped.push(outcome.skipped);
  }

  const warnings: string[] = [];
  if (skipped.length > 0) {
    warnings.push(
      `${skipped.length} row(s) carried neither a value nor an observation and were skipped: ${skipped
        .slice(0, 5)
        .join(', ')}${skipped.length > 5 ? '…' : ''}.`,
    );
  }
  if (unmapped.length > 0) {
    warnings.push(
      `${unmapped.length} row(s) could not be mapped to a core review area: ${unmapped
        .slice(0, 5)
        .map((u) => u.label)
        .join(', ')}${unmapped.length > 5 ? '…' : ''}. Assign them manually.`,
    );
  }

  return { results, unmapped, warnings };
}

/**
 * Parse a JSON eval export. Accepts the three shapes seen in practice:
 *   1. `[{area, parameter, value}, …]`
 *   2. `{results: [...]}` / `{metrics: [...]}` / `{evaluations: [...]}`
 *   3. `{safety: {...}, security: [...]}` — keyed by area
 */
export function parseJsonEvidence(payload: unknown): IngestionOutcome {
  const rows: { row: Record<string, unknown>; fallbackArea?: string }[] = [];

  const pushArray = (arr: unknown[], fallbackArea?: string) => {
    for (const item of arr) {
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        rows.push({ row: item as Record<string, unknown>, fallbackArea });
      }
    }
  };

  if (Array.isArray(payload)) {
    pushArray(payload);
  } else if (payload && typeof payload === 'object') {
    const obj = payload as Record<string, unknown>;
    const container = obj.results ?? obj.metrics ?? obj.evaluations ?? obj.data;

    if (Array.isArray(container)) {
      pushArray(container);
    } else {
      // Keyed-by-area shape: each key is an area, each value a row or list of rows.
      for (const [key, value] of Object.entries(obj)) {
        if (Array.isArray(value)) {
          pushArray(value, key);
        } else if (value && typeof value === 'object') {
          rows.push({ row: value as Record<string, unknown>, fallbackArea: key });
        } else if (typeof value === 'number' || typeof value === 'string') {
          // Flat `{"hallucination_rate": 0.03}` — synthesize a row.
          rows.push({ row: { parameter: key, value }, fallbackArea: key });
        }
      }
    }
  }

  if (rows.length === 0) {
    return { results: [], unmapped: [], warnings: ['No evaluation rows were found in the payload.'] };
  }
  return collect(rows);
}

/**
 * Minimal RFC-4180 CSV reader: handles quoted fields, escaped quotes, embedded
 * commas and newlines, and CRLF. Kept in-repo rather than pulling a dependency
 * for what is a single well-specified format.
 */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      // Swallow the LF of a CRLF pair.
      if (char === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
    } else {
      field += char;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  const nonEmpty = rows.filter((r) => r.some((cell) => cell.trim() !== ''));
  if (nonEmpty.length < 2) return [];

  const headers = nonEmpty[0].map((h) => h.trim());
  return nonEmpty.slice(1).map((cells) => {
    const record: Record<string, string> = {};
    headers.forEach((header, i) => {
      record[header] = (cells[i] ?? '').trim();
    });
    return record;
  });
}

export function parseCsvEvidence(text: string): IngestionOutcome {
  const records = parseCsv(text);
  if (records.length === 0) {
    return { results: [], unmapped: [], warnings: ['The CSV had no data rows below its header.'] };
  }
  return collect(records.map((row) => ({ row })));
}

/**
 * Parse a Markdown results table — the format a human writes up after a review
 * meeting. Reads the first pipe table it finds.
 */
export function parseMarkdownEvidence(text: string): IngestionOutcome {
  const lines = text.split(/\r?\n/);
  const tableStart = lines.findIndex(
    (line, i) =>
      line.trim().startsWith('|') &&
      i + 1 < lines.length &&
      /^\s*\|?[\s:-]*-[\s:|-]*\|?\s*$/.test(lines[i + 1]),
  );
  if (tableStart === -1) {
    return { results: [], unmapped: [], warnings: ['No Markdown table was found in the document.'] };
  }

  const splitRow = (line: string) =>
    line
      .trim()
      .replace(/^\||\|$/g, '')
      .split('|')
      .map((cell) => cell.trim());

  const headers = splitRow(lines[tableStart]);
  const rows: Record<string, string>[] = [];

  for (let i = tableStart + 2; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line.startsWith('|')) break;
    const cells = splitRow(line);
    const record: Record<string, string> = {};
    headers.forEach((header, idx) => {
      record[header] = cells[idx] ?? '';
    });
    rows.push(record);
  }

  if (rows.length === 0) {
    return { results: [], unmapped: [], warnings: ['The Markdown table had a header but no data rows.'] };
  }
  return collect(rows.map((row) => ({ row })));
}

/** Dispatch on file extension / MIME type for the upload path. */
export function parseEvidenceFile(fileName: string, mimeType: string, text: string): IngestionOutcome {
  const lower = fileName.toLowerCase();

  if (lower.endsWith('.json') || mimeType === 'application/json') {
    try {
      return parseJsonEvidence(JSON.parse(text));
    } catch (err) {
      return {
        results: [],
        unmapped: [],
        warnings: [`The file is not valid JSON: ${err instanceof Error ? err.message : 'parse error'}`],
      };
    }
  }
  if (lower.endsWith('.csv') || mimeType === 'text/csv') return parseCsvEvidence(text);
  if (lower.endsWith('.md') || lower.endsWith('.markdown') || mimeType === 'text/markdown') {
    return parseMarkdownEvidence(text);
  }

  // Unknown extension: sniff the content rather than refusing outright.
  const trimmed = text.trimStart();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      return parseJsonEvidence(JSON.parse(text));
    } catch {
      /* fall through to CSV */
    }
  }
  if (trimmed.includes('|')) {
    const md = parseMarkdownEvidence(text);
    if (md.results.length > 0) return md;
  }
  return parseCsvEvidence(text);
}
