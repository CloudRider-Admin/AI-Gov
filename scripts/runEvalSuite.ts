/**
 * CLI entry for the Govi eval harness.
 *
 * Usage:
 *   npm run eval:govi                 # full suite (live)
 *   EVAL_MOCK=1 npm run eval:govi     # synthetic outputs, no API calls
 *   npm run eval:govi -- --filter doc # only run cases whose id matches "doc"
 *
 * Exit code 0 = pass rate ≥ baseline (or no baseline yet, mock mode, or
 * baseline override). Exit code 1 = regression beyond the threshold.
 *
 * @see GOVI_GOVSECURE_INTEGRATION_PLAN.md — Phase 1.5.4
 */

import { promises as fs } from 'fs';
import path from 'path';

import { runEvalSuite } from '../src/lib/ai/evals/runner';
import type { EvalReport } from '../src/lib/ai/evals/types';

const BASELINE_PATH = path.join(process.cwd(), 'evals', 'baseline.json');
const REGRESSION_TOLERANCE = 0.02; // pass-rate may drop by at most 2 percentage points.

interface CliArgs {
  filterSubstring?: string;
  updateBaseline: boolean;
  noWriteReport: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { updateBaseline: false, noWriteReport: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--filter' && argv[i + 1]) {
      args.filterSubstring = argv[i + 1];
      i += 1;
    } else if (a === '--update-baseline') {
      args.updateBaseline = true;
    } else if (a === '--no-report') {
      args.noWriteReport = true;
    }
  }
  return args;
}

async function loadBaseline(): Promise<{ passRate: number; meanOverall: number } | null> {
  try {
    const raw = await fs.readFile(BASELINE_PATH, 'utf8');
    return JSON.parse(raw) as { passRate: number; meanOverall: number };
  } catch {
    return null;
  }
}

async function writeBaseline(report: EvalReport): Promise<void> {
  await fs.mkdir(path.dirname(BASELINE_PATH), { recursive: true });
  await fs.writeFile(
    BASELINE_PATH,
    JSON.stringify(
      {
        capturedAt: new Date().toISOString(),
        rubricVersion: report.rubricVersion,
        passRate: report.passRate,
        meanOverall: report.meanOverall,
        totalCases: report.totalCases,
      },
      null,
      2,
    ),
  );
}

function summarise(report: EvalReport): void {
  const lines: string[] = [];
  lines.push('');
  lines.push('━━━ Govi Eval Suite ━━━');
  lines.push(`rubric ${report.rubricVersion}  |  ${report.totalCases} cases  |  ${report.durationSec}s`);
  lines.push(
    `passed ${report.passed}  failed ${report.failed}  errored ${report.errored}  pass-rate ${(report.passRate * 100).toFixed(1)}%`,
  );
  lines.push(`mean overall: ${report.meanOverall.toFixed(3)}`);
  lines.push('');
  lines.push('per-category:');
  for (const [cat, row] of Object.entries(report.byCategory)) {
    lines.push(
      `  ${cat.padEnd(22)} pass ${row.passed}/${row.total}  rate ${(row.passRate * 100).toFixed(1)}%  mean ${row.meanOverall.toFixed(3)}`,
    );
  }
  lines.push('');

  const failedCases = report.cases.filter((c) => !c.passed && !c.error);
  if (failedCases.length) {
    lines.push(`failed cases (${failedCases.length}):`);
    for (const c of failedCases) {
      lines.push(`  - ${c.caseId.padEnd(38)} overall ${c.overall.toFixed(3)}  missing ${c.deterministic.missingClauses.length}  forbidden ${c.deterministic.forbiddenHits.length}`);
    }
    lines.push('');
  }

  const erroredCases = report.cases.filter((c) => c.error);
  if (erroredCases.length) {
    lines.push(`errored / skipped (${erroredCases.length}):`);
    for (const c of erroredCases) {
      lines.push(`  - ${c.caseId.padEnd(38)} ${c.error}`);
    }
    lines.push('');
  }

  process.stdout.write(`${lines.join('\n')}\n`);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const filter = args.filterSubstring
    ? (id: string) => id.includes(args.filterSubstring!)
    : undefined;

  const isMock = process.env.EVAL_MOCK === '1' || !process.env.OPENAI_API_KEY;

  const report = await runEvalSuite({ filter, noWriteReport: args.noWriteReport });
  summarise(report);

  if (args.updateBaseline) {
    if (isMock) {
      process.stderr.write(
        '\nrefusing to capture a baseline in mock mode — set OPENAI_API_KEY and rerun.\n',
      );
      process.exit(2);
    }
    await writeBaseline(report);
    process.stdout.write(`baseline updated → ${BASELINE_PATH}\n`);
    process.exit(0);
  }

  if (isMock) {
    process.stdout.write(
      'mock mode — baseline regression check skipped. Set OPENAI_API_KEY for the live gate.\n',
    );
    process.exit(0);
  }

  const baseline = await loadBaseline();
  if (!baseline) {
    process.stdout.write(
      'no baseline yet — capture one with: npm run eval:govi -- --update-baseline\n',
    );
    process.exit(0);
  }

  const delta = report.passRate - baseline.passRate;
  process.stdout.write(
    `baseline pass-rate: ${(baseline.passRate * 100).toFixed(1)}%  |  delta: ${(delta * 100).toFixed(1)}pp\n`,
  );
  if (delta < -REGRESSION_TOLERANCE) {
    process.stderr.write(
      `\n❌ regression: pass-rate dropped ${Math.abs(delta * 100).toFixed(1)}pp (tolerance ${REGRESSION_TOLERANCE * 100}pp)\n`,
    );
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  process.stderr.write(`eval runner crashed: ${err instanceof Error ? err.stack : String(err)}\n`);
  process.exit(2);
});
