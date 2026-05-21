import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useSpecies } from '../hooks/useSpecies';
import { listCultivars, mediaUrl } from '../lib/api';
import type { PublicCultivarSummary } from '../lib/types';

function Hero() {
  return (
    <section className="container-prose pt-20 pb-24 md:pt-28 md:pb-32">
      <div className="max-w-3xl">
        <p className="text-[11px] uppercase tracking-[0.22em] text-accent-700 mb-6">Commercial fruit tree nursery</p>
        <h1 className="font-serif text-5xl md:text-7xl leading-[1.05] tracking-tightish">
          Cultivars chosen by orchardists, propagated to commercial volume.
        </h1>
        <p className="mt-8 text-lg text-ink-muted leading-relaxed max-w-2xl">
          Factree supplies Australian commercial growers with replant‑grade scion and rootstock —
          modern cultivars, proven heritage, and consistent quality at scale.
        </p>
        <div className="mt-10 flex items-center gap-6 text-sm">
          <Link
            to="/contact"
            className="inline-flex items-center gap-2 bg-ink text-stone-50 px-6 py-3 rounded-sm hover:bg-accent-700 transition-colors"
          >
            Request a catalogue
          </Link>
          <a href="#species" className="text-ink-muted hover:text-ink">Browse cultivars →</a>
        </div>
      </div>
    </section>
  );
}

function SpeciesGrid() {
  const { species, loading } = useSpecies();
  return (
    <section id="species" className="container-prose pb-24">
      <div className="flex items-end justify-between mb-10">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-accent-700 mb-3">By species</p>
          <h2 className="font-serif text-3xl md:text-4xl tracking-tightish">What we grow</h2>
        </div>
      </div>
      {loading ? (
        <div className="text-sm text-ink-muted">Loading…</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {species.map((s) => (
            <Link
              key={s.id}
              to={`/${s.slug}`}
              className="group block rounded border border-stone-200 bg-white p-6 hover:border-accent-500 transition-colors"
            >
              <div className="font-serif text-2xl tracking-tightish text-ink group-hover:text-accent-700">{s.name}</div>
              <div className="mt-2 text-xs uppercase tracking-[0.15em] text-ink-muted">
                {s.cultivar_count} cultivar{s.cultivar_count === 1 ? '' : 's'}
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

function Featured() {
  const [cultivars, setCultivars] = useState<PublicCultivarSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    listCultivars()
      .then((data) => { if (!cancelled) setCultivars(data.slice(0, 4)); })
      .catch(() => { /* swallow; section just renders empty */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (loading || cultivars.length === 0) return null;

  return (
    <section className="bg-white border-y border-stone-200">
      <div className="container-prose py-20">
        <p className="text-[11px] uppercase tracking-[0.22em] text-accent-700 mb-3">Featured cultivars</p>
        <h2 className="font-serif text-3xl md:text-4xl tracking-tightish mb-12">A selection from the catalogue</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {cultivars.map((c) => (
            <Link key={c.id} to={`/cultivar/${c.id}`} className="group block">
              <div className="aspect-[4/5] overflow-hidden rounded bg-stone-100">
                {c.hero_media_id && (
                  <img
                    src={mediaUrl(c.hero_media_id)!}
                    alt={c.name}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                  />
                )}
              </div>
              <div className="mt-4">
                <div className="font-serif text-xl tracking-tightish">{c.trade_name || c.name}</div>
                {c.crop_type_name && (
                  <div className="mt-1 text-xs uppercase tracking-[0.14em] text-ink-muted">{c.crop_type_name}</div>
                )}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function Values() {
  return (
    <section className="container-prose py-24">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
        <div>
          <h3 className="font-serif text-xl mb-3">Commercial volumes</h3>
          <p className="text-sm text-ink-muted leading-relaxed">
            Orders sized for orchard developments and replants. Forward contracts available across multiple seasons.
          </p>
        </div>
        <div>
          <h3 className="font-serif text-xl mb-3">Licensed cultivars</h3>
          <p className="text-sm text-ink-muted leading-relaxed">
            We propagate under formal license from breeders and rights holders. Every tree leaves with full provenance.
          </p>
        </div>
        <div>
          <h3 className="font-serif text-xl mb-3">Field‑proven data</h3>
          <p className="text-sm text-ink-muted leading-relaxed">
            Cultivar profiles draw from our living registry of evaluator and grower observations across Australian regions.
          </p>
        </div>
      </div>
    </section>
  );
}

export default function HomePage() {
  return (
    <>
      <Hero />
      <Featured />
      <SpeciesGrid />
      <Values />
    </>
  );
}
