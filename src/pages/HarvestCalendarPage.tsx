import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getMaturityChart } from '../lib/api';
import {
  buildCropTypeColours, colourKeyFor, EMPTY_HARVEST_FILTERS,
  type HarvestFilterState, type HarvestGroupBy,
} from '../lib/maturityChart';
import type { PublicMaturityChart } from '../lib/types';
import HarvestTimeline, { HarvestChartKey, HarvestLegend } from '../components/HarvestTimeline';

/**
 * The public harvest calendar: when every published cultivar picks, across
 * districts and seasons, colour-coded by crop type.
 *
 * Same data and same maths as the internal chart in tech.factree.com.au, over
 * `/api/public/maturity-chart`, which restricts itself to cultivars whose owner
 * has flipped "Publish to website". There is no parameter that widens it — the
 * gate lives on the route, not in the query string.
 *
 * Distinct from `MaturityChart.tsx`, the per-cultivar "Seasonal calendar" on the
 * cultivar page, which infers month bands from public attribute names and knows
 * nothing about districts, seasons or recorded pick dates.
 */

const GROUP_BY: HarvestGroupBy[] = ['crop_type', 'region', 'none'];

function parseIds(raw: string | null): number[] {
  if (!raw) return [];
  return raw.split(',').map(Number).filter((n) => Number.isFinite(n));
}

function toggle(list: number[], id: number): number[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

function Chip({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-sm border px-3 py-1.5 text-sm transition-colors ${
        active
          ? 'border-ink bg-ink text-stone-50'
          : 'border-stone-200 bg-white text-ink-muted hover:text-ink'
      }`}
    >
      {children}
    </button>
  );
}

export default function HarvestCalendarPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [filters, setFilters] = useState<HarvestFilterState>(() => ({
    seasonYears: parseIds(searchParams.get('seasons')),
    regionIds: parseIds(searchParams.get('regions')),
    cropTypeIds: parseIds(searchParams.get('crops')),
    fromDate: searchParams.get('from') || '',
    toDate: searchParams.get('to') || '',
    includeEstimates: searchParams.get('estimates') !== 'false',
    groupBy: GROUP_BY.includes(searchParams.get('group') as HarvestGroupBy)
      ? (searchParams.get('group') as HarvestGroupBy)
      : 'crop_type',
  }));

  const [chart, setChart] = useState<PublicMaturityChart | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getMaturityChart({
      seasonYears: filters.seasonYears,
      regionIds: filters.regionIds,
      cropTypeIds: filters.cropTypeIds,
      fromDate: filters.fromDate || undefined,
      toDate: filters.toDate || undefined,
      includeEstimates: filters.includeEstimates,
    })
      .then((data) => { if (!cancelled) setChart(data); })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [filters]);

  useEffect(() => load(), [load]);

  // Keep the URL in step so a filtered calendar can be linked to.
  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.seasonYears.length) params.set('seasons', filters.seasonYears.join(','));
    if (filters.regionIds.length) params.set('regions', filters.regionIds.join(','));
    if (filters.cropTypeIds.length) params.set('crops', filters.cropTypeIds.join(','));
    if (filters.fromDate) params.set('from', filters.fromDate);
    if (filters.toDate) params.set('to', filters.toDate);
    if (!filters.includeEstimates) params.set('estimates', 'false');
    if (filters.groupBy !== 'crop_type') params.set('group', filters.groupBy);
    setSearchParams(params, { replace: true });
  }, [filters, setSearchParams]);

  // Keyed off the facets, which do not move when a filter changes — so
  // switching a crop type off never repaints the ones still on screen.
  const colours = useMemo(
    () => buildCropTypeColours(chart?.facets.crop_types ?? []),
    [chart?.facets.crop_types]
  );

  const counts = useMemo(() => {
    const map = new Map<number, number>();
    for (const e of chart?.entries ?? []) {
      const key = colourKeyFor(e, colours);
      map.set(key.id, (map.get(key.id) ?? 0) + 1);
    }
    return map;
  }, [chart?.entries, colours]);

  const entries = chart?.entries ?? [];
  const recordedCount = entries.filter((e) => e.source !== 'calculated').length;
  const calculatedCount = entries.length - recordedCount;
  const showRegion = new Set(entries.map((e) => e.growing_region_id)).size > 1;
  const showSeason = new Set(entries.map((e) => e.season_year)).size > 1;

  const facets = chart?.facets ?? { seasons: [], regions: [], crop_types: [] };
  // With no explicit pick the server chose a season for us; showing it as
  // selected is the difference between "nothing is filtered" and a season the
  // visitor is looking at without being told.
  const shownSeasons = filters.seasonYears.length > 0
    ? filters.seasonYears
    : (chart?.filters_applied.season_years ?? []);

  const dirty =
    filters.seasonYears.length > 0 || filters.regionIds.length > 0 ||
    filters.cropTypeIds.length > 0 || filters.fromDate !== '' || filters.toDate !== '' ||
    !filters.includeEstimates;

  const set = (patch: Partial<HarvestFilterState>) => setFilters((f) => ({ ...f, ...patch }));

  return (
    <div className="container-prose py-20">
      <p className="text-[11px] uppercase tracking-[0.22em] text-accent-700 mb-4">Catalogue</p>
      <h1 className="font-serif text-5xl md:text-6xl tracking-tightish">Harvest calendar</h1>
      <p className="mt-6 max-w-2xl text-lg text-ink-muted leading-relaxed">
        When each variety picks, laid out on one timeline and coloured by crop. Filter it down to
        the crops, districts and dates you plant for.
      </p>

      {/* Filters. One row above the chart, in the order they are reached for. */}
      <div className="mt-12 space-y-6">
        {facets.seasons.length > 0 && (
          <div>
            <div className="flex items-baseline justify-between gap-3 mb-3">
              <h2 className="text-[11px] uppercase tracking-[0.22em] text-ink-muted">Season</h2>
              {dirty && (
                <button
                  type="button"
                  onClick={() => setFilters({ ...EMPTY_HARVEST_FILTERS, groupBy: filters.groupBy })}
                  className="text-sm text-accent-700 hover:underline"
                >
                  Reset filters
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {facets.seasons.map((y) => (
                <Chip
                  key={y}
                  active={shownSeasons.includes(y)}
                  onClick={() => set({ seasonYears: toggle(filters.seasonYears, y) })}
                >
                  {y}
                </Chip>
              ))}
            </div>
          </div>
        )}

        {facets.regions.length > 0 && (
          <div>
            <h2 className="text-[11px] uppercase tracking-[0.22em] text-ink-muted mb-3">
              District {filters.regionIds.length === 0 && <span className="normal-case tracking-normal text-stone-400">— all</span>}
            </h2>
            <div className="flex flex-wrap gap-2">
              {facets.regions.map((r) => (
                <Chip
                  key={r.id}
                  active={filters.regionIds.includes(r.id)}
                  onClick={() => set({ regionIds: toggle(filters.regionIds, r.id) })}
                >
                  {r.name}
                </Chip>
              ))}
            </div>
          </div>
        )}

        {facets.crop_types.length > 0 && (
          <div>
            <h2 className="text-[11px] uppercase tracking-[0.22em] text-ink-muted mb-3">Crop</h2>
            <HarvestLegend
              colours={colours}
              counts={counts}
              selected={new Set(filters.cropTypeIds)}
              onToggle={(id) => set({ cropTypeIds: toggle(filters.cropTypeIds, id) })}
            />
          </div>
        )}

        <div className="flex flex-wrap items-end gap-x-10 gap-y-6">
          <div>
            <h2 className="text-[11px] uppercase tracking-[0.22em] text-ink-muted mb-3">Picking between</h2>
            <div className="flex items-center gap-2">
              <input
                type="date"
                aria-label="Picking from"
                value={filters.fromDate}
                onChange={(e) => set({ fromDate: e.target.value })}
                className="rounded-sm border border-stone-200 bg-white px-3 py-1.5 text-sm text-ink min-w-0"
              />
              <span className="text-sm text-ink-muted shrink-0">to</span>
              <input
                type="date"
                aria-label="Picking to"
                value={filters.toDate}
                onChange={(e) => set({ toDate: e.target.value })}
                className="rounded-sm border border-stone-200 bg-white px-3 py-1.5 text-sm text-ink min-w-0"
              />
            </div>
          </div>

          <div>
            <h2 className="text-[11px] uppercase tracking-[0.22em] text-ink-muted mb-3">Group by</h2>
            <div className="flex flex-wrap gap-2">
              {([
                ['crop_type', 'Crop'],
                ['region', 'District'],
                ['none', 'None'],
              ] as const).map(([key, label]) => (
                <Chip key={key} active={filters.groupBy === key} onClick={() => set({ groupBy: key })}>
                  {label}
                </Chip>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-ink-muted cursor-pointer">
            <input
              type="checkbox"
              checked={filters.includeEstimates}
              onChange={(e) => set({ includeEstimates: e.target.checked })}
            />
            Include estimated dates
          </label>
        </div>
      </div>

      <div className="mt-12 space-y-6">
        {loading ? (
          <div className="text-sm text-ink-muted">Loading…</div>
        ) : error ? (
          <div className="text-sm text-red-700">{error}</div>
        ) : entries.length === 0 ? (
          <div className="rounded border border-stone-200 bg-white p-12 text-center">
            <h2 className="font-serif text-2xl mb-3">Nothing to show</h2>
            <p className="text-ink-muted max-w-md mx-auto">
              {facets.seasons.length === 0
                ? 'No picking dates have been published yet.'
                : 'No varieties match these filters. Try a wider season, district or date range.'}
            </p>
          </div>
        ) : (
          <>
            <HarvestTimeline
              entries={entries}
              colours={colours}
              groupBy={filters.groupBy}
              showRegion={showRegion}
              showSeason={showSeason}
            />
            {chart?.truncated && (
              <p className="text-sm text-ink-muted">
                Showing the first {entries.length} of {chart.total_matched} entries. Narrow the
                season, district or crop to see the rest.
              </p>
            )}
            <HarvestChartKey recordedCount={recordedCount} calculatedCount={calculatedCount} />
          </>
        )}
      </div>
    </div>
  );
}
