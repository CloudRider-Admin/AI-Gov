/**
 * Occupational roles captured at onboarding. The role tailors the advisor's
 * clarifying questions (see `systemPrompt.ts`) and is surfaced as the requestor
 * lens on generated intake risk assessments.
 *
 * `value` is the canonical token stored on `User.occupationalRole`; `label` is
 * the display string injected into prompt context, chosen so its keywords line
 * up with the role lenses enumerated in the governance system prompt.
 */
export interface OccupationalRole {
  value: string;
  label: string;
}

export const OCCUPATIONAL_ROLES: OccupationalRole[] = [
  { value: 'security', label: 'Security / CISO' },
  { value: 'privacy-legal', label: 'Privacy / Legal / DPO' },
  { value: 'engineering', label: 'Engineering / Data Science' },
  { value: 'executive', label: 'Founder / Executive' },
  { value: 'operations', label: 'Operations / Product / PM' },
  { value: 'governance', label: 'Risk / Compliance / Governance' },
  { value: 'other', label: 'Other' },
];

/** Resolve a stored role token to its display label. Returns undefined for
 *  unknown/empty values so callers can omit the requestor lens entirely. */
export function roleLabel(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  return OCCUPATIONAL_ROLES.find((r) => r.value === value)?.label;
}
