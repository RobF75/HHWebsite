/**
 * Plant Breeder's Rights (PBR) — IP Australia labelling constants (public website).
 *
 * Source of truth: IP Australia "Industry guidelines for labelling".
 *
 * These strings are LEGALLY REQUIRED wording — do NOT paraphrase, do NOT
 * abbreviate, do NOT translate. Render verbatim. Italicise the Act name.
 *
 * This file MUST stay byte-for-byte aligned with the matching constants in
 * `HHNodeServer/src/constants/pbr.js` and `HHjsFrontEnd/src/constants/pbr.ts`
 * (PBR_WARNING_TEXT, PBR_ACT_NAME, PBR_PROTECTED_STATUSES). The backend ships a
 * `pbr_notice` payload on /api/public/* responses built from the same strings.
 * If you edit one, edit the others in the same commit.
 */

/** Mandatory warning text shown with the PBR logo for a protected variety. */
export const PBR_WARNING_TEXT =
  'Unauthorised commercial propagation or any sale, conditioning, export, import or stocking of propagating material of this variety is an infringement under the Plant Breeder’s Rights Act 1994.';

/** The Act name, isolated so consumers can italicise it without splitting the warning. */
export const PBR_ACT_NAME = 'Plant Breeder’s Rights Act 1994';

/** Protection status values for which the symbol + warning MUST be shown. */
export const PBR_PROTECTED_STATUSES = ['pending', 'protected'] as const;
export type PbrProtectedStatus = (typeof PBR_PROTECTED_STATUSES)[number];

export function isPbrProtected(
  status: string | null | undefined,
): status is PbrProtectedStatus {
  return !!status && (PBR_PROTECTED_STATUSES as readonly string[]).includes(status);
}
