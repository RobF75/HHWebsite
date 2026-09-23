/**
 * The non-visual half of the harvest calendar: its query string, the colour a
 * crop type gets, and the calendar axis maths.
 *
 * This mirrors `src/utils/maturityChart.ts` in HHjsFrontEnd deliberately. The
 * two apps are separate repos with no shared package, and the thing that must
 * not drift is the *colour assignment* — the public harvest calendar and the
 * internal one are the same data, and Apple reading green here and blue there
 * would make them look like different charts. If you change the palette or the
 * assignment rule, change it in both.
 */

import type {
  PublicMaturityCropTypeFacet,
  PublicMaturityEntry,
  PublicMaturityFilters,
} from './types';

// ---------------------------------------------------------------------------
// Filter state
// ---------------------------------------------------------------------------

export type HarvestGroupBy = 'crop_type' | 'region' | 'none';

export interface HarvestFilterState {
  seasonYears: number[];
  /** Every season with data, laid over one season's calendar. Overrides seasonYears. */
  allSeasons: boolean;
  regionIds: number[];
  cropTypeIds: number[];
  fromDate: string;
  toDate: string;
  includeEstimates: boolean;
  groupBy: HarvestGroupBy;
}

export const EMPTY_HARVEST_FILTERS: HarvestFilterState = {
  seasonYears: [],
  allSeasons: false,
  regionIds: [],
  cropTypeIds: [],
  fromDate: '',
  toDate: '',
  includeEstimates: true,
  groupBy: 'crop_type',
};

// ---------------------------------------------------------------------------
// Query string
// ---------------------------------------------------------------------------

/** Lists go over as `region_ids=3,7`, so a filtered calendar is a shareable URL. */
export function maturityChartQuery(filters: PublicMaturityFilters): string {
  const params = new URLSearchParams();
  if (filters.allSeasons) params.set('all_seasons', 'true');
  else if (filters.seasonYears?.length) params.set('season_years', filters.seasonYears.join(','));
  if (filters.regionIds?.length) params.set('region_ids', filters.regionIds.join(','));
  if (filters.cropTypeIds?.length) params.set('crop_type_ids', filters.cropTypeIds.join(','));
  if (filters.fromDate) params.set('from_date', filters.fromDate);
  if (filters.toDate) params.set('to_date', filters.toDate);
  if (filters.includeEstimates === false) params.set('include_estimates', 'false');
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

// ---------------------------------------------------------------------------
// Colour
// ---------------------------------------------------------------------------

/**
 * Eight categorical hues, in this order.
 *
 * Validated against a white card: every slot inside the lightness band and over
 * the chroma floor, worst adjacent colour-vision-deficiency ΔE 9.1 (target ≥ 8)
 * and worst normal-vision ΔE 19.6 (floor ≥ 15). Three sit under 3:1 contrast on
 * white, which is only permitted because every bar carries its own cultivar name
 * and date — identity never rests on colour alone. Do not reorder: the ordering
 * is what clears the CVD gate.
 *
 * These are louder than the site's stone-and-green palette on purpose. Eight
 * crop types cannot be told apart in one accent colour, and a calendar whose
 * categories are indistinguishable is decoration.
 */
export const CROP_TYPE_COLOURS = [
  '#2a78d6', // blue
  '#eb6834', // orange
  '#1baf7a', // aqua
  '#eda100', // yellow
  '#e87ba4', // magenta
  '#008300', // green
  '#4a3aa7', // violet
  '#e34948', // red
] as const;

/** Everything past the eighth crop type. Neutral on purpose — not a ninth hue. */
export const OTHER_CROP_TYPE_COLOUR = '#8a8a8a';

/** The bucket entries with no crop type fall into. Negative so it cannot collide with a real id. */
export const UNCLASSIFIED_CROP_TYPE_ID = -1;

export interface CropTypeColourKey {
  id: number;
  name: string;
  colour: string;
  isOther: boolean;
}

/**
 * The top-level crop type an entry belongs to.
 *
 * Colour follows the root, so "Apple" and "Apple → Gala group" are one colour
 * and one legend row rather than two. `crop_types` is a two-level hierarchy, so
 * the parent is always the root.
 */
export function rootCropType(
  entry: Pick<PublicMaturityEntry, 'crop_type_id' | 'crop_type_name' | 'crop_type_parent_id' | 'crop_type_parent_name'>
): { id: number; name: string } | null {
  if (entry.crop_type_parent_id != null) {
    return { id: entry.crop_type_parent_id, name: entry.crop_type_parent_name ?? 'Unnamed' };
  }
  if (entry.crop_type_id != null) {
    return { id: entry.crop_type_id, name: entry.crop_type_name ?? 'Unnamed' };
  }
  return null;
}

/**
 * Assign a colour to every top-level crop type in the dataset.
 *
 * Built from the facets — what exists, not what is currently shown — and
 * ordered alphabetically. Both matter: a colour taken from position in the
 * *filtered* result would repaint the survivors every time a filter moved.
 */
export function buildCropTypeColours(
  facets: PublicMaturityCropTypeFacet[]
): Map<number, CropTypeColourKey> {
  const roots = new Map<number, string>();
  for (const ct of facets) {
    if (ct.parent_id != null) roots.set(ct.parent_id, ct.parent_name ?? 'Unnamed');
    else roots.set(ct.id, ct.name);
  }

  const ordered = [...roots.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const out = new Map<number, CropTypeColourKey>();
  ordered.forEach(([id, name], i) => {
    const isOther = i >= CROP_TYPE_COLOURS.length;
    out.set(id, { id, name, colour: isOther ? OTHER_CROP_TYPE_COLOUR : CROP_TYPE_COLOURS[i], isOther });
  });

  out.set(UNCLASSIFIED_CROP_TYPE_ID, {
    id: UNCLASSIFIED_CROP_TYPE_ID,
    name: 'Other',
    colour: OTHER_CROP_TYPE_COLOUR,
    isOther: true,
  });
  return out;
}

/** The colour key an entry renders in. Never null — an unclassified cultivar still gets a bar. */
export function colourKeyFor(
  entry: PublicMaturityEntry,
  colours: Map<number, CropTypeColourKey>
): CropTypeColourKey {
  const root = rootCropType(entry);
  const key = root ? colours.get(root.id) : undefined;
  return key ?? colours.get(UNCLASSIFIED_CROP_TYPE_ID)!;
}

// ---------------------------------------------------------------------------
// Calendar axis
// ---------------------------------------------------------------------------

export const MS_PER_DAY = 86400000;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * A `YYYY-MM-DD` date as a UTC timestamp.
 *
 * Parsed by hand rather than via `new Date(str)`, which reads a bare date as UTC
 * midnight and then renders it in the visitor's own zone — one timezone west and
 * every pick date shows a day early.
 */
export function toUtc(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

/** "16 Mar". Deliberately not `toLocaleDateString`, which would use the visitor's zone. */
export function shortDate(dateStr: string): string {
  const [, m, d] = dateStr.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]}`;
}

/** "16 Mar 2026". */
export function shortDateWithYear(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

export interface Axis {
  min: number;
  max: number;
  span: number;
  /**
   * Set when more than one season is in view: every date is moved onto this
   * season's calendar before it is placed, so the same variety's years line up
   * instead of stretching into a timeline several years wide.
   */
  foldToSeason: number | null;
}

/**
 * Where an entry's bar ends: a recorded last pick, or the first pick plus a
 * harvest window when only a start is known. The fallbacks cover a server that
 * predates `window_end_date`.
 */
export function windowEnd(e: PublicMaturityEntry): string {
  return e.window_end_date || e.last_pick_date || e.first_pick_date;
}

/** True when the bar's end was measured rather than assumed from a window length. */
export function hasRecordedEnd(e: PublicMaturityEntry): boolean {
  return e.window_source ? e.window_source === 'recorded' : !!e.last_pick_date;
}

/** A date moved by whole seasons onto `toSeason`'s calendar, keeping a Dec–Jan run in order. */
function foldedUtc(dateStr: string, entrySeason: number, toSeason: number | null): number {
  if (toSeason == null || toSeason === entrySeason) return toUtc(dateStr);
  const [y, m, d] = dateStr.split('-').map(Number);
  return Date.UTC(y + (toSeason - entrySeason), m - 1, d);
}

/**
 * The axis spans the data plus a few days, so an end bar is not flush to the edge.
 * Seasons fold onto the most recent one whenever more than one is present.
 */
export function buildAxis(entries: PublicMaturityEntry[]): Axis | null {
  if (entries.length === 0) return null;
  const seasons = new Set(entries.map((e) => e.season_year));
  const foldToSeason = seasons.size > 1 ? Math.max(...seasons) : null;

  let min = Infinity;
  let max = -Infinity;
  for (const e of entries) {
    const start = foldedUtc(e.first_pick_date, e.season_year, foldToSeason);
    const end = foldedUtc(windowEnd(e), e.season_year, foldToSeason);
    if (start < min) min = start;
    if (end > max) max = end;
  }
  min -= 3 * MS_PER_DAY;
  max += 3 * MS_PER_DAY;
  return { min, max, span: Math.max(max - min, MS_PER_DAY), foldToSeason };
}

/** Where a date sits on the axis, 0–100. Pass the entry's season so a folded axis can move it. */
export function axisPercent(axis: Axis, dateStr: string, seasonYear?: number): number {
  const t = seasonYear == null ? toUtc(dateStr) : foldedUtc(dateStr, seasonYear, axis.foldToSeason);
  return ((t - axis.min) / axis.span) * 100;
}

/** A span of N days as a percentage of the axis — for uncertainty bands. */
export function daysPercent(axis: Axis, days: number): number {
  return (days * MS_PER_DAY / axis.span) * 100;
}

export interface Gridline {
  key: string;
  label: string;
  left: number;
}

/**
 * Month gridlines.
 *
 * The label carries the year whenever the axis crosses one: southern-hemisphere
 * harvests run through New Year, so a bare "Jan" on an axis starting in December
 * is genuinely ambiguous about which season it belongs to.
 */
export function buildGridlines(axis: Axis | null): Gridline[] {
  if (!axis) return [];
  const lines: Gridline[] = [];
  // A folded axis is a season's calendar, not a particular year's.
  const spansYears = axis.foldToSeason == null
    && new Date(axis.min).getUTCFullYear() !== new Date(axis.max).getUTCFullYear();
  let y = new Date(axis.min).getUTCFullYear();
  let m = new Date(axis.min).getUTCMonth();

  for (let i = 0; i < 160; i++) {
    const t = Date.UTC(y, m, 1);
    if (t > axis.max) break;
    if (t >= axis.min) {
      lines.push({
        key: `${y}-${m}`,
        label: spansYears && m === 0 ? `Jan ${String(y).slice(2)}` : MONTHS[m],
        left: ((t - axis.min) / axis.span) * 100,
      });
    }
    m += 1;
    if (m > 11) { m = 0; y += 1; }
  }

  // A dense axis would print a label per month on top of itself at phone width.
  const step = lines.length > 18 ? Math.ceil(lines.length / 12) : 1;
  return step === 1 ? lines : lines.filter((_, i) => i % step === 0);
}
