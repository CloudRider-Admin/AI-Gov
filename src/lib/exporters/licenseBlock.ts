/**
 * GovSecure standard license / disclaimer block.
 *
 * Appended to every generated GovSecure-licensed document by the Word and
 * PDF exporters. Treat the text as canonical — wording changes need to be
 * approved by Legal because customers contract on this language.
 *
 * @see GOVI_GOVSECURE_INTEGRATION_PLAN.md — Phase 2.6.6
 */

export const LICENSE_HEADING = 'GovSecure Licensing and Usage';

export const LICENSE_PARAGRAPHS: { heading: string; body: string }[] = [
  {
    heading: 'License scope',
    body:
      'This document is licensed for internal business use by the purchasing organization and its controlled affiliates. ' +
      'Redistribution, resale, sub-licensing, or external publication of this template — in whole or in part — is not permitted ' +
      'without prior written consent from GovSecure.',
  },
  {
    heading: 'No legal advice',
    body:
      'This document is provided for informational and operational purposes only. It does not constitute legal, regulatory, ' +
      'or compliance advice. The purchasing organization should engage qualified counsel to confirm that the language ' +
      'reflects its specific legal obligations and risk posture before formal adoption.',
  },
  {
    heading: 'Customization responsibility',
    body:
      'The purchasing organization is responsible for tailoring named roles, escalation paths, jurisdictional references, ' +
      'control identifiers, and any standards or regulations cited in this document to its actual operating environment. ' +
      'Generated content reflects best-effort grounding in NIST AI RMF 1.0, EU AI Act (2024/1689), ISO/IEC 42001:2023, ' +
      'and GDPR — verify each citation against the authoritative source before publication.',
  },
  {
    heading: 'No warranty',
    body:
      'This document is provided "as is" without warranty of any kind. GovSecure disclaims any liability arising from the ' +
      'use of, or reliance on, the contents of this document.',
  },
] as const;

/** Render the license block as a markdown string — useful for the PDF path. */
export function renderLicenseMarkdown(): string {
  const lines: string[] = [`## ${LICENSE_HEADING}`, ''];
  for (const p of LICENSE_PARAGRAPHS) {
    lines.push(`**${p.heading}.** ${p.body}`);
    lines.push('');
  }
  return lines.join('\n');
}
