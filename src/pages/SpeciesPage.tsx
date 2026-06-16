import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { listCultivars } from '../lib/api';
import { useSpecies } from '../hooks/useSpecies';
import type { PublicCultivarSummary } from '../lib/types';
import CultivarCard from '../components/CultivarCard';
import PbrNotice from '../components/PbrNotice';
import { isPbrProtected } from '../lib/pbr';

export default function SpeciesPage() {
  const { speciesSlug } = useParams<{ speciesSlug: string }>();
  const { species, loading: speciesLoading } = useSpecies();
  const [cultivars, setCultivars] = useState<PublicCultivarSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<'all' | 'scion' | 'rootstock'>('all');

  const current = useMemo(
    () => species.find((s) => s.slug === speciesSlug) ?? null,
    [species, speciesSlug]
  );

  useEffect(() => {
    if (!speciesSlug) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    listCultivars(speciesSlug)
      .then((data) => { if (!cancelled) setCultivars(data); })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [speciesSlug]);

  const filtered = cultivars.filter((c) => roleFilter === 'all' ? true : c.cultivar_role === roleFilter);
  const hasRootstocks = cultivars.some((c) => c.cultivar_role === 'rootstock');

  if (!speciesLoading && species.length > 0 && !current) {
    return (
      <div className="container-prose py-32 text-center">
        <h1 className="font-serif text-3xl mb-4">Species not found</h1>
        <p className="text-ink-muted">We don't currently list <em>{speciesSlug}</em> on the public catalogue.</p>
        <Link to="/" className="mt-6 inline-block text-accent-700 hover:underline">← Back to home</Link>
      </div>
    );
  }

  return (
    <div className="container-prose py-20">
      <p className="text-[11px] uppercase tracking-[0.22em] text-accent-700 mb-4">Species</p>
      <h1 className="font-serif text-5xl md:text-6xl tracking-tightish">{current?.name ?? '…'}</h1>
      {current?.description && (
        <p className="mt-6 max-w-2xl text-lg text-ink-muted leading-relaxed">{current.description}</p>
      )}

      {hasRootstocks && (
        <div className="mt-10 inline-flex border border-stone-200 rounded-sm overflow-hidden text-sm">
          {(['all', 'scion', 'rootstock'] as const).map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => setRoleFilter(opt)}
              className={`px-4 py-2 capitalize ${roleFilter === opt ? 'bg-ink text-stone-50' : 'bg-white text-ink-muted hover:text-ink'}`}
            >
              {opt === 'all' ? 'All' : opt + 's'}
            </button>
          ))}
        </div>
      )}

      <div className="mt-12">
        {loading ? (
          <div className="text-sm text-ink-muted">Loading…</div>
        ) : error ? (
          <div className="text-sm text-red-700">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="text-sm text-ink-muted">No cultivars to display.</div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-12">
              {filtered.map((c) => (
                <CultivarCard key={c.id} cultivar={c} />
              ))}
            </div>
            <PbrNotice
              show={filtered.some((c) => isPbrProtected(c.protection_status))}
              className="mt-12"
            />
          </>
        )}
      </div>
    </div>
  );
}
