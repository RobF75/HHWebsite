/**
 * PbrNotice — the full PBR logo + verbatim warning text block.
 *
 * Render this on every view that also renders a <PbrMark> for a protected
 * variety. IP Australia's industry guidelines require the symbol and the
 * accompanying warning to appear together — neither is sufficient alone.
 *
 * Pass `status` to gate visibility on a single cultivar, or omit it (and pass
 * `show`) when gating on a list (e.g. "any protected cultivar on this page").
 * The Act name is italicised verbatim.
 */
import { PBR_ACT_NAME, PBR_WARNING_TEXT, isPbrProtected } from '../lib/pbr';
import pbrLogo from '../assets/pbr/pbr-logo-black.png';

interface Props {
  /** Single-cultivar gate — render nothing unless this status is protected. */
  status?: string | null;
  /** Explicit gate for list contexts — render nothing when false. */
  show?: boolean;
  /** Extra className for the outer block. */
  className?: string;
}

export default function PbrNotice({ status, show, className }: Props) {
  // Gate on whichever signal was provided. If both are omitted, render.
  if (status !== undefined && !isPbrProtected(status)) return null;
  if (show === false) return null;

  const [beforeAct, afterAct] = PBR_WARNING_TEXT.split(PBR_ACT_NAME);

  return (
    <aside
      role="note"
      aria-label="Plant Breeder’s Rights notice"
      className={`flex items-start gap-3 rounded border border-stone-200 bg-stone-50 p-4 text-xs leading-snug text-ink-muted ${className ?? ''}`}
    >
      <img src={pbrLogo} alt="PBR logo" className="h-12 w-auto flex-none" />
      <p className="m-0">
        {beforeAct}
        <em>{PBR_ACT_NAME}</em>
        {afterAct}
      </p>
    </aside>
  );
}
