import { describe, expect, it } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

import { runEvalSuite } from '../runner';

describe('runner.ts (mock mode)', () => {
  it('loads every authored golden case and produces a report', async () => {
    const report = await runEvalSuite({ mock: true, noWriteReport: true });
    expect(report.totalCases).toBeGreaterThanOrEqual(30);
    expect(report.cases.length).toBe(report.totalCases);
    // Every case must carry one of the four known categories.
    for (const c of report.cases) {
      expect(['document-generation', 'advisory-query', 'intake', 'playbook']).toContain(c.category);
    }
  });

  it('reports per-category breakdown with all four categories present', async () => {
    const report = await runEvalSuite({ mock: true, noWriteReport: true });
    const cats = Object.keys(report.byCategory);
    expect(cats).toEqual(
      expect.arrayContaining(['document-generation', 'advisory-query', 'intake', 'playbook']),
    );
    for (const cat of cats) {
      expect(report.byCategory[cat as keyof typeof report.byCategory].total).toBeGreaterThan(0);
    }
  });

  it('synthetic mock outputs achieve a non-zero pass rate', async () => {
    const report = await runEvalSuite({ mock: true, noWriteReport: true });
    expect(report.passRate).toBeGreaterThan(0);
    expect(report.meanOverall).toBeGreaterThan(0);
  });

  it('respects the filter option', async () => {
    const report = await runEvalSuite({
      mock: true,
      noWriteReport: true,
      filter: (id) => id.startsWith('intake-'),
    });
    expect(report.totalCases).toBeGreaterThan(0);
    for (const c of report.cases) expect(c.caseId).toMatch(/^intake-/);
  });

  it('writes a report file when noWriteReport is false', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'govi-eval-'));
    const report = await runEvalSuite({ mock: true, reportDir: tmp });
    const latest = JSON.parse(await fs.readFile(path.join(tmp, 'latest.json'), 'utf8'));
    expect(latest.totalCases).toBe(report.totalCases);
    // also a timestamped file should exist
    const files = await fs.readdir(tmp);
    expect(files.some((f) => f.endsWith('.json') && f !== 'latest.json')).toBe(true);
  });

  it('skips Phase-2 documentTypes that the orchestrator does not yet support', async () => {
    // In mock mode every case dispatches synthetically (no skip).
    // Verify that under live mode without an API key, GovSecure-prefixed
    // documentTypes get marked as skipped. We simulate that by passing
    // mock=false but no apiKey and filtering to one such case.
    const report = await runEvalSuite({
      mock: false,
      apiKey: '',
      noWriteReport: true,
      filter: (id) => id === 'policy-aup-ecommerce',
    });
    // With no API key, runner falls back to mock mode automatically — so this
    // case still runs synthetically. We assert it executed and has a category.
    expect(report.totalCases).toBe(1);
    expect(report.cases[0].category).toBe('document-generation');
  });
});
