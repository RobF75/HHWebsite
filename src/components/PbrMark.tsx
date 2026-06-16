/**
 * PbrMark — inline Plant Breeder's Rights symbol, rendered immediately after a
 * protected variety name.
 *
 * Placement per IP Australia's "Industry guidelines for labelling":
 *   - Symbol sits on the same baseline as the variety name.
 *   - Gap to the name ≈ width of a lowercase "c" (~0.4em).
 *   - Sized to ~1em so it matches the surrounding text's cap-height.
 *
 * Renders nothing unless the cultivar is under provisional/full PBR protection.
 * You MUST also render <PbrNotice /> on the same view — the verbatim warning is
 * part of the legal notice and the symbol on its own is non-compliant.
 */
import { isPbrProtected } from '../lib/pbr';
import pbrSymbol from '../assets/pbr/pbr-symbol-black.png';

interface Props {
  /** Cultivar protection status — 'pending' | 'protected' triggers the mark. */
  status: string | null | undefined;
  /** Extra className for the wrapper span. */
  className?: string;
}

export default function PbrMark({ status, className }: Props) {
  if (!isPbrProtected(status)) return null;

  const label = 'Plant Breeder’s Rights protected variety';
  return (
    <span
      className={className}
      // 0.4em ≈ width of a lowercase "c"; sized to the surrounding cap-height.
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        marginLeft: '0.4em',
        verticalAlign: 'baseline',
        lineHeight: 1,
      }}
      aria-label={label}
      title={label}
    >
      <img
        src={pbrSymbol}
        alt=""
        aria-hidden="true"
        style={{ height: '1em', width: 'auto', display: 'block' }}
      />
    </span>
  );
}
