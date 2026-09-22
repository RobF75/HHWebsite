import { Fragment, useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { PublicMaturityEntry } from '../lib/types';
import {
  axisPercent, buildAxis, buildGridlines, colourKeyFor, daysPercent,
  rootCropType, shortDate, shortDateWithYear, UNCLASSIFIED_CROP_TYPE_ID,
  type CropTypeColourKey, type HarvestGroupBy,
} from '../lib/maturityChart';

/**
 * The harvest calendar: every published cultivar's picking window laid along a
 * calendar axis, coloured by crop type.
 *
 * Plain CSS-positioned bars — this site carries no charting dependency, and one
 * axis does not justify adding one.
 *
 * Presentation only. Fetching and filtering live in the page above, which is
 * what keeps this the same shape as the internal chart in HHjsFrontEnd.
 */

interface Props {
  entries: PublicMaturityEntry[];
  colours: Map<number, CropTypeColourKey>;
  groupBy: HarvestGroupBy;
  /** Shown per row when more than one region is in view. */
  showRegion: boolean;
  /** Shown per row when more than one season is in view. */
  showSeason: boolean;
}

interface Group {
  key: string;
  label: string;
  colour: string | null;
  entries: PublicMaturityEntry[];
}

export default function HarvestTimeline({
  entries, colours, groupBy, showRegion, showSeason,
}: Props) {
  const axis = useMemo(() => buildAxis(entries), [entries]);
  const gridlines = useMemo(() => buildGridlines(axis), [axis]);

  const groups = useMemo<Group[]>(() => {
    if (groupBy === 'none') return [{ key: 'all', label: '', colour: null, entries }];
    const map = new Map<string, Group>();
    for (const e of entries) {
      let key: string;
      let label: string;
      let colour: string | null;
      if (groupBy === 'crop_type') {
        const ck = colourKeyFor(e, colours);
        key = `c${ck.id}`;
        label = ck.name;
        colour = ck.colour;
      } else {
        key = `r${e.growing_region_id}`;
        label = e.region_name ?? `Region ${e.growing_region_id}`;
        colour = null;
      }
      if (!map.has(key)) map.set(key, { key, label, colour, entries: [] });
      map.get(key)!.entries.push(e);
    }
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [entries, groupBy, colours]);

  if (!axis) return null;

  const renderBar = (e: PublicMaturityEntry) => {
    const isCalculated = e.source === 'calculated';
    const key = colourKeyFor(e, colours);
    const left = axisPercent(axis, e.first_pick_date);
    const right = e.last_pick_date ? axisPercent(axis, e.last_pick_date) : left;
    // A single-date entry still needs a visible mark.
    const width = Math.max(right - left, 1.5);
    const root = rootCropType(e);

    const title = [
      e.cultivar_name ?? `Cultivar ${e.cultivar_id}`,
      root ? `· ${root.name}` : null,
      `· ${e.region_name ?? `Region ${e.growing_region_id}`}`,
      isCalculated
        ? `\nEstimated ${shortDateWithYear(e.first_pick_date)} ±${e.uncertainty_days} days`
        : `\n${shortDateWithYear(e.first_pick_date)}${e.last_pick_date ? ` – ${shortDateWithYear(e.last_pick_date)}` : ''}`,
    ].filter(Boolean).join(' ');

    return (
      <Link
        key={`${e.cultivar_id}-${e.growing_region_id}-${e.season_year}-${e.source}`}
        to={`/cultivar/${e.cultivar_id}`}
        title={title}
        className="flex items-center gap-3 py-1.5 -mx-2 px-2 rounded-sm hover:bg-stone-50"
      >
        <div className="w-28 sm:w-52 shrink-0 min-w-0">
          <span className="text-sm text-ink truncate block">
            {e.cultivar_name || `Cultivar ${e.cultivar_id}`}
          </span>
          {(showRegion || showSeason) && (
            <span className="text-[11px] text-ink-muted truncate block">
              {showRegion && (e.region_name ?? `Region ${e.growing_region_id}`)}
              {showRegion && showSeason && ' · '}
              {showSeason && e.season_year}
            </span>
          )}
        </div>

        <div className="relative flex-1 h-6 min-w-0">
          {/* Uncertainty band behind the bar, for estimates only. */}
          {isCalculated && e.uncertainty_days > 0 && (
            <div
              className="absolute top-1/2 -translate-y-1/2 h-4 rounded-sm bg-stone-200/70"
              style={{
                left: `${Math.max(0, left - daysPercent(axis, e.uncertainty_days))}%`,
                width: `${width + 2 * daysPercent(axis, e.uncertainty_days)}%`,
              }}
            />
          )}
          <div
            className="absolute top-1/2 -translate-y-1/2 h-3 rounded-sm"
            style={{
              left: `${left}%`,
              width: `${width}%`,
              // A 2px surface ring stops two touching bars reading as one.
              boxShadow: '0 0 0 2px #ffffff',
              ...(isCalculated
                ? {
                  // Estimates are hollow: the crop-type hue still identifies
                  // them, but they cannot be read as a measured date.
                  backgroundColor: 'transparent',
                  border: `1.5px dashed ${key.colour}`,
                }
                : { backgroundColor: key.colour }),
            }}
          />
        </div>

        <div className="w-16 sm:w-24 shrink-0 text-right">
          <span className={`text-xs tabular-nums ${isCalculated ? 'text-stone-400 italic' : 'text-ink-muted'}`}>
            {shortDate(e.first_pick_date)}
            {isCalculated && '*'}
          </span>
        </div>
      </Link>
    );
  };

  return (
    <div className="rounded border border-stone-200 bg-white p-4 sm:p-6 overflow-x-auto">
      <div className="min-w-[480px]">
        {/* Gridlines inset to line up with the bar track between the two labels. */}
        <div className="relative h-4 mb-2" style={{ marginLeft: '7.75rem', marginRight: '4rem' }}>
          {gridlines.map((g) => (
            <div key={g.key} className="absolute top-0" style={{ left: `${g.left}%` }}>
              <span className="block -translate-x-1/2 whitespace-nowrap text-[10px] uppercase tracking-[0.12em] text-ink-muted">
                {g.label}
              </span>
            </div>
          ))}
        </div>

        {groups.map((g) => (
          <Fragment key={g.key}>
            {groupBy !== 'none' && (
              <div className="flex items-center gap-2 pt-4 pb-1 first:pt-0">
                {g.colour && (
                  <span
                    className="inline-block w-3 h-3 rounded-sm shrink-0"
                    style={{ backgroundColor: g.colour }}
                  />
                )}
                <span className="font-serif text-base text-ink truncate">{g.label}</span>
                <span className="text-[11px] text-ink-muted shrink-0">{g.entries.length}</span>
              </div>
            )}
            {g.entries.map(renderBar)}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

/**
 * The legend, doubling as the crop-type filter.
 *
 * Present whenever there is more than one crop type — identity on this chart is
 * never carried by colour alone, and each bar's own label is the other half of
 * that.
 */
export function HarvestLegend({
  colours, counts, selected, onToggle,
}: {
  colours: Map<number, CropTypeColourKey>;
  counts: Map<number, number>;
  selected: Set<number>;
  onToggle: (cropTypeId: number) => void;
}) {
  // Every crop type in the dataset, not only those currently drawn — these
  // chips are the filter, so a deselected one must stay on screen to be
  // switched back on. The "Other" bucket appears only when something lands in it.
  const shown = [...colours.values()]
    .filter((k) => k.id !== UNCLASSIFIED_CROP_TYPE_ID || (counts.get(k.id) ?? 0) > 0)
    .sort((a, b) => a.name.localeCompare(b.name));

  if (shown.length === 0) return null;
  const anySelected = selected.size > 0;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {shown.map((k) => {
        const on = !anySelected || selected.has(k.id);
        return (
          <button
            key={k.id}
            type="button"
            onClick={() => onToggle(k.id)}
            aria-pressed={on}
            className={`flex items-center gap-2 rounded-sm border px-3 py-1.5 text-sm transition-colors ${
              on
                ? 'border-stone-300 bg-white text-ink'
                : 'border-stone-200 bg-stone-50 text-stone-400'
            }`}
          >
            <span
              className="inline-block w-2.5 h-2.5 rounded-sm shrink-0"
              style={{ backgroundColor: k.colour, opacity: on ? 1 : 0.35 }}
            />
            <span className="truncate max-w-[9rem]">{k.name}</span>
            <span className="tabular-nums text-[11px] text-ink-muted">{counts.get(k.id) ?? 0}</span>
          </button>
        );
      })}
    </div>
  );
}

/** What the two bar styles mean. Sits under the chart. */
export function HarvestChartKey({
  recordedCount, calculatedCount,
}: { recordedCount: number; calculatedCount: number }) {
  return (
    <div className="text-sm text-ink-muted space-y-2">
      <div className="flex items-center gap-5 flex-wrap">
        <span className="flex items-center gap-2">
          <span className="inline-block w-5 h-2.5 rounded-sm bg-stone-500" />
          Recorded pick
        </span>
        {calculatedCount > 0 && (
          <span className="flex items-center gap-2">
            <span className="inline-block w-5 h-2.5 rounded-sm border-[1.5px] border-dashed border-stone-500" />
            Estimated
          </span>
        )}
        <span>
          {recordedCount} recorded
          {calculatedCount > 0 && `, ${calculatedCount} estimated`}
        </span>
      </div>
      {calculatedCount > 0 && (
        <p className="max-w-3xl leading-relaxed">
          * An estimated entry has no recorded pick in that district. It is worked out from the
          same cultivar picked elsewhere in the same season, plus the measured timing difference
          between the two districts; the grey band shows the spread in that difference. Treat
          these as a guide, not as a commitment.
        </p>
      )}
      <p className="max-w-3xl leading-relaxed">
        Picking dates vary with the season, the site and the year. Use this to compare cultivars
        against each other rather than as a delivery date.
      </p>
    </div>
  );
}
