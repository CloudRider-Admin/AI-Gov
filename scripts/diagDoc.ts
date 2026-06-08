/* Temp diagnostic: run DocumentOrchestrator for one golden case and dump headings. */
import { promises as fs } from 'fs';
import path from 'path';
import { documentOrchestrator } from '../src/lib/ai/multiAgent';
import { DOCUMENT_SECTION_TEMPLATES } from '../src/lib/ai/documentTemplates';

async function main() {
  const id = process.argv[2] ?? 'policy-risk-approval-mfg';
  const gc = JSON.parse(
    await fs.readFile(
      path.join(process.cwd(), 'src/lib/ai/evals/golden', `${id}.golden.json`),
      'utf8',
    ),
  );
  const apiKey = process.env.OPENAI_API_KEY!;
  const res = await documentOrchestrator.run(
    {
      documentType: gc.documentType,
      riskTier: gc.input.riskTier,
      useCaseDescription: gc.input.useCaseDescription,
      useCaseName: gc.input.useCaseName,
      context: gc.input.context,
    },
    apiKey,
  );
  const templateHeadings = (DOCUMENT_SECTION_TEMPLATES as any)[gc.documentType].map(
    (s: any) => s.heading,
  );
  const producedHeadings = (res as any).sections.map((s: any) => s.heading);
  console.log('=== TEMPLATE HEADINGS ===');
  console.log(templateHeadings.join('\n'));
  console.log('\n=== PRODUCED HEADINGS ===');
  console.log(producedHeadings.join('\n'));
  console.log('\n=== EXPECTED SECTIONS (golden) ===');
  console.log((gc.expectedSections ?? []).join('\n'));
  console.log('\n=== MARKDOWN (first 1600 chars) ===');
  console.log(res.markdownExport.slice(0, 1600));
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
