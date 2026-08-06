/**
 * Gate posture context for Govi.
 *
 * Gives the advisor the same view of the gate pipeline a user is looking at, so
 * "what's holding up the support copilot?" is answered from the register rather
 * than from generic governance advice.
 *
 * Deliberately compact: this rides along on every advisor turn, so it is capped
 * and summarized rather than dumped in full. Only entities that are actually
 * moving or stuck are named; cleared ones are counted, not listed.
 */

import { getGateBoard } from './gates';
import { GATE_SPECS, ENTITY_KIND_LABELS, type EntityKind } from './gateEnums';

/** Never name more than this many entities, however large the register is. */
const MAX_LISTED = 8;

export async function buildGatePostureContext(userId: string): Promise<string> {
  const board = await getGateBoard(userId).catch(() => []);
  if (board.length === 0) return '';

  const lines: string[] = ['GOVERNANCE GATE POSTURE (this user\'s register):'];

  const cleared = board.filter((e) => e.currentGate === 4);
  const inFlight = board.filter((e) => e.currentGate < 4);

  lines.push(
    `${board.length} registered entit${board.length === 1 ? 'y' : 'ies'}: ` +
      `${inFlight.length} still in the gates, ${cleared.length} cleared all three.`,
  );

  // Blocked first, then earliest gate — the things a user is most likely asking about.
  const ordered = [...inFlight].sort((a, b) => {
    const aBlocked = a.gates.some((g) => g.status === 'failed') ? 0 : 1;
    const bBlocked = b.gates.some((g) => g.status === 'failed') ? 0 : 1;
    if (aBlocked !== bBlocked) return aBlocked - bBlocked;
    return a.currentGate - b.currentGate;
  });

  for (const entry of ordered.slice(0, MAX_LISTED)) {
    const kind = ENTITY_KIND_LABELS[entry.entityKind as EntityKind] ?? entry.entityKind;
    const gateName = GATE_SPECS[entry.currentGate as 1 | 2 | 3]?.name ?? 'unknown';
    const current = entry.gates.find((g) => g.gate === entry.currentGate);

    const parts = [
      `- "${entry.name}" (${kind}, ${entry.riskCategory} risk) is at Gate ${entry.currentGate} — ${gateName}, status ${current?.status ?? 'not-started'}`,
    ];
    if (entry.approvalStatus != null) parts.push(`approval ${entry.approvalStatus}`);
    if (entry.latestRunVerdict) parts.push(`latest evaluation verdict ${entry.latestRunVerdict}`);
    if (entry.openRemediation > 0) parts.push(`${entry.openRemediation} open remediation task(s)`);
    lines.push(`${parts.join('; ')}.`);

    if (current?.blockers?.length) {
      lines.push(`  blocked by: ${current.blockers.slice(0, 2).join(' ')}`);
    }
  }

  if (ordered.length > MAX_LISTED) {
    lines.push(`- …and ${ordered.length - MAX_LISTED} more in the gates.`);
  }

  lines.push(
    'When the user asks about approval, evaluation evidence, or what is blocking something, ' +
      'answer from this posture. Approval is required only at medium risk and above, and is ' +
      'recorded only after remediation completes.',
  );

  return lines.join('\n');
}
