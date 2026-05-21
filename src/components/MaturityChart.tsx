import type { PublicAttributeValue } from '../lib/types';

interface Props {
  attributes: PublicAttributeValue[];
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface Window {
  label: string;
  startMonth: number; // 0-11
  endMonth: number;   // 0-11
  color: string;
}

/**
 * Parses a value into a month index. Accepts:
 *   - a JSON object {month: 1-12}
 *   - a JSON object {start: 'YYYY-MM-DD', end: 'YYYY-MM-DD'}  (range type)
 *   - a date string 'YYYY-MM-DD'
 *   - a month name string ('March', 'mar')
 *   - a number 1-12
 */
function toMonth(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === 'number') return value >= 1 && value <= 12 ? value - 1 : null;
  if (typeof value === 'string') {
    const dateMatch = value.match(/^(\d{4})-(\d{2})-/);
    if (dateMatch) return Math.max(0, Math.min(11, parseInt(dateMatch[2], 10) - 1));
    const i = MONTHS.findIndex((m) => m.toLowerCase() === value.slice(0, 3).toLowerCase());
    if (i >= 0) return i;
    const n = parseInt(value, 10);
    if (Number.isFinite(n) && n >= 1 && n <= 12) return n - 1;
    return null;
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (typeof obj.month === 'number') return toMonth(obj.month);
    if (typeof obj.start === 'string') return toMonth(obj.start);
  }
  return null;
}

function toRange(value: unknown): { start: number; end: number } | null {
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const start = toMonth(obj.start);
    const end = toMonth(obj.end);
    if (start != null && end != null) return { start, end };
  }
  return null;
}

const WINDOW_DEFS: Array<{ matchSlug: RegExp; label: string; color: string }> = [
  { matchSlug: /bloom/i,    label: 'Bloom',    color: '#f0a4c2' },
  { matchSlug: /flower/i,   label: 'Flower',   color: '#f0a4c2' },
  { matchSlug: /pollin/i,   label: 'Pollen',   color: '#fde68a' },
  { matchSlug: /harvest/i,  label: 'Harvest',  color: '#557a4d' },
  { matchSlug: /maturity/i, label: 'Maturity', color: '#557a4d' },
  { matchSlug: /pick/i,     label: 'Pick',     color: '#557a4d' },
];

function detectWindows(attributes: PublicAttributeValue[]): Window[] {
  const out: Window[] = [];
  for (const def of WINDOW_DEFS) {
    const matching = attributes.filter((a) => def.matchSlug.test(a.attribute_slug) || def.matchSlug.test(a.attribute_name));
    if (matching.length === 0) continue;

    // Prefer a range-typed value if present.
    const ranged = matching.find((a) => a.attribute_data_type === 'range' && toRange(a.value));
    if (ranged) {
      const r = toRange(ranged.value)!;
      out.push({ label: def.label, startMonth: r.start, endMonth: r.end, color: def.color });
      continue;
    }

    // Otherwise pair up start/end by slug suffix.
    const start = matching.find((a) => /start|begin|from/i.test(a.attribute_slug));
    const end = matching.find((a) => /end|finish|to/i.test(a.attribute_slug));
    const s = toMonth(start?.value);
    const e = toMonth(end?.value);
    if (s != null && e != null) {
      out.push({ label: def.label, startMonth: s, endMonth: e, color: def.color });
      continue;
    }

    // Single-point fallback.
    const single = toMonth(matching[0].value);
    if (single != null) {
      out.push({ label: def.label, startMonth: single, endMonth: single, color: def.color });
    }
  }
  return out;
}

export default function MaturityChart({ attributes }: Props) {
  const windows = detectWindows(attributes);
  if (windows.length === 0) return null;

  return (
    <section className="mt-16">
      <h2 className="font-serif text-2xl tracking-tightish mb-1">Seasonal calendar</h2>
      <p className="text-sm text-ink-muted mb-6">Southern hemisphere — typical commercial timing for this cultivar.</p>

      <div className="rounded border border-stone-200 bg-white p-5 sm:p-8">
        <div className="grid grid-cols-12 gap-0 text-[10px] uppercase tracking-[0.12em] text-ink-muted mb-3">
          {MONTHS.map((m) => (
            <div key={m} className="text-center">{m}</div>
          ))}
        </div>

        <div className="space-y-4">
          {windows.map((w) => {
            const wraps = w.endMonth < w.startMonth;
            const cells = Array.from({ length: 12 }, (_, i) => {
              const inside = wraps
                ? i >= w.startMonth || i <= w.endMonth
                : i >= w.startMonth && i <= w.endMonth;
              return inside;
            });
            return (
              <div key={w.label} className="flex items-center gap-4">
                <div className="w-20 text-sm text-ink">{w.label}</div>
                <div className="flex-1 grid grid-cols-12 gap-1">
                  {cells.map((on, i) => (
                    <div
                      key={i}
                      className="h-6 rounded-sm"
                      style={{ background: on ? w.color : '#f1efe9' }}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
