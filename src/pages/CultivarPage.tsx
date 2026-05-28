import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getCultivar, mediaUrl } from '../lib/api';
import type { PublicCultivarDetail, PublicAttributeValue, PublicCultivarProgram } from '../lib/types';
import MaturityChart from '../components/MaturityChart';
import CultivarOrderCta from '../components/CultivarOrderCta';

const PROGRAM_TYPE_LABELS: Record<PublicCultivarProgram['program_type'], string> = {
  annual_tree_royalty: 'Annual tree royalty',
  production_royalty: 'Production royalty',
  per_sale_royalty: 'Per-sale royalty',
  other: 'Licensing program',
};

function ProgramPanel({ program }: { program: PublicCultivarProgram }) {
  const accent = program.brand_color || undefined;
  const typeLabel =
    program.program_type === 'other' && program.custom_type_label
      ? program.custom_type_label
      : PROGRAM_TYPE_LABELS[program.program_type];

  return (
    <section
      className="mt-16 rounded border border-stone-200 overflow-hidden"
      style={accent ? { borderTopWidth: 4, borderTopColor: accent } : undefined}
    >
      {program.hero_image_url && (
        <div className="aspect-[21/9] overflow-hidden bg-stone-100">
          <img
            src={program.hero_image_url}
            alt={`${program.name} banner`}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        </div>
      )}

      <div className="p-6 md:p-8">
        <div className="flex items-start gap-4">
          {program.logo_url && (
            <img
              src={program.logo_url}
              alt={`${program.name} logo`}
              className="h-12 w-12 object-contain rounded bg-white border border-stone-200 p-1 flex-none"
              loading="lazy"
            />
          )}
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-[0.18em] text-accent-700">
              {typeLabel}
            </div>
            <h2 className="font-serif text-2xl tracking-tightish mt-1">{program.name}</h2>
            {program.organisation_name && (
              <p className="text-sm text-ink-muted mt-0.5">by {program.organisation_name}</p>
            )}
          </div>
        </div>

        {program.tagline && (
          <p className="mt-4 text-base text-ink-muted leading-relaxed">{program.tagline}</p>
        )}

        {program.marketing_description && (
          <div className="mt-5 text-sm text-ink leading-relaxed whitespace-pre-line">
            {program.marketing_description}
          </div>
        )}

        {program.website_terms && (
          <details className="mt-6 group">
            <summary className="cursor-pointer text-sm font-medium text-ink hover:text-accent-700">
              Conditions of growing
            </summary>
            <div className="mt-3 text-sm text-ink-muted leading-relaxed whitespace-pre-line border-l-2 border-stone-200 pl-4">
              {program.website_terms}
            </div>
          </details>
        )}

        {program.external_url && (
          <a
            href={program.external_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-flex items-center gap-2 text-sm text-accent-700 hover:underline"
            style={accent ? { color: accent } : undefined}
          >
            Visit program website →
          </a>
        )}
      </div>
    </section>
  );
}

function formatValue(av: PublicAttributeValue): string {
  const v = av.value;
  if (v == null) return '—';
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return av.attribute_unit ? `${v} ${av.attribute_unit}` : String(v);
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if ('n' in o) return av.attribute_unit ? `${o.n} ${av.attribute_unit}` : String(o.n);
    if ('s' in o) return String(o.s);
    if ('min' in o || 'max' in o) {
      const unit = av.attribute_unit ? ` ${av.attribute_unit}` : '';
      if (o.min != null && o.max != null) return `${o.min}–${o.max}${unit}`;
      if (o.min != null) return `from ${o.min}${unit}`;
      if (o.max != null) return `up to ${o.max}${unit}`;
    }
    if ('start' in o || 'end' in o) {
      return `${o.start ?? '?'} – ${o.end ?? '?'}`;
    }
  }
  return JSON.stringify(v);
}

function AttributeGroups({ attributes }: { attributes: PublicAttributeValue[] }) {
  // Deduplicate to one row per attribute (latest first) so we don't list seasonal
  // observations multiple times in the spec table.
  const seen = new Set<string>();
  const collapsed = attributes.filter((a) => {
    if (seen.has(a.attribute_slug)) return false;
    seen.add(a.attribute_slug);
    return true;
  });

  const grouped = collapsed.reduce<Record<string, PublicAttributeValue[]>>((acc, a) => {
    (acc[a.attribute_category] ||= []).push(a);
    return acc;
  }, {});

  const categories = Object.keys(grouped);
  if (categories.length === 0) return null;

  return (
    <section className="mt-16">
      <h2 className="font-serif text-2xl tracking-tightish mb-6">Cultivar specifications</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
        {categories.map((cat) => (
          <div key={cat}>
            <h3 className="text-[11px] uppercase tracking-[0.18em] text-accent-700 mb-4">{cat}</h3>
            <dl className="divide-y divide-stone-200 border-t border-b border-stone-200">
              {grouped[cat].map((a) => (
                <div key={a.id} className="py-3 grid grid-cols-2 gap-4 text-sm">
                  <dt className="text-ink-muted">{a.attribute_name}</dt>
                  <dd className="text-ink">{formatValue(a)}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function CultivarPage() {
  const { id } = useParams<{ id: string }>();
  const [cultivar, setCultivar] = useState<PublicCultivarDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    getCultivar(Number(id))
      .then((data) => { if (!cancelled) setCultivar(data); })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  if (loading) {
    return <div className="container-prose py-32 text-sm text-ink-muted">Loading…</div>;
  }
  if (error || !cultivar) {
    return (
      <div className="container-prose py-32 text-center">
        <h1 className="font-serif text-3xl mb-4">Cultivar not found</h1>
        <p className="text-ink-muted">{error || 'This cultivar is not currently published on the public catalogue.'}</p>
        <Link to="/" className="mt-6 inline-block text-accent-700 hover:underline">← Back to home</Link>
      </div>
    );
  }

  const hero = mediaUrl(cultivar.hero_media_id);
  const gallery = cultivar.media.filter((m) => m.id !== cultivar.hero_media_id);

  return (
    <article>
      {/* Header */}
      <div className="container-prose pt-16 pb-10">
        <div className="text-[11px] uppercase tracking-[0.18em] text-accent-700 mb-4">
          {cultivar.crop_type_name && cultivar.crop_type_slug ? (
            <Link to={`/${cultivar.crop_type_slug}`} className="hover:text-ink">{cultivar.crop_type_name}</Link>
          ) : (
            cultivar.crop_type_name
          )}
        </div>
        <h1 className="font-serif text-5xl md:text-7xl tracking-tightish leading-[1.05]">
          {cultivar.trade_name || cultivar.name}
        </h1>
        {cultivar.trade_name && cultivar.name !== cultivar.trade_name && (
          <p className="mt-4 text-xl text-ink-muted italic">{cultivar.name}</p>
        )}
        {cultivar.botanical_name && (
          <p className="mt-2 text-sm text-ink-muted">{cultivar.botanical_name}</p>
        )}
        {cultivar.website_tagline && (
          <p className="mt-8 max-w-2xl text-lg text-ink-muted leading-relaxed">{cultivar.website_tagline}</p>
        )}
      </div>

      {/* Hero image */}
      {hero && (
        <div className="container-prose">
          <div className="overflow-hidden rounded bg-stone-100 flex justify-center">
            <img src={hero} alt={cultivar.name} className="max-h-[70vh] w-auto object-contain" />
          </div>
        </div>
      )}

      {/* Body */}
      <div className="container-prose py-16">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          <div className="lg:col-span-2">
            {cultivar.website_description && (
              <div className="prose-like text-base text-ink leading-relaxed whitespace-pre-line">
                {cultivar.website_description}
              </div>
            )}

            <MaturityChart attributes={cultivar.attributes} />

            {cultivar.programs
              ?.filter((p) => p.is_public)
              .map((p) => <ProgramPanel key={p.id} program={p} />)}

            <AttributeGroups attributes={cultivar.attributes} />

            {gallery.length > 0 && (
              <section className="mt-16">
                <h2 className="font-serif text-2xl tracking-tightish mb-6">Gallery</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {gallery.map((m) => (
                    <div key={m.id} className="aspect-square overflow-hidden rounded bg-stone-100">
                      <img src={mediaUrl(m.id)!} alt={m.caption || m.file_name} loading="lazy" className="h-full w-full object-cover" />
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          <aside className="lg:sticky lg:top-28 lg:self-start space-y-8">
            <div className="rounded border border-stone-200 bg-white p-6">
              <h3 className="font-serif text-lg mb-4">At a glance</h3>
              <dl className="space-y-3 text-sm">
                {cultivar.crop_type_name && (
                  <div className="flex justify-between"><dt className="text-ink-muted">Species</dt><dd>{cultivar.crop_type_name}</dd></div>
                )}
                {cultivar.cultivar_role && (
                  <div className="flex justify-between"><dt className="text-ink-muted">Role</dt><dd className="capitalize">{cultivar.cultivar_role}</dd></div>
                )}
                {cultivar.origin_country && (
                  <div className="flex justify-between"><dt className="text-ink-muted">Origin</dt><dd>{cultivar.origin_country}</dd></div>
                )}
                {cultivar.year_bred && (
                  <div className="flex justify-between"><dt className="text-ink-muted">Bred</dt><dd>{cultivar.year_bred}</dd></div>
                )}
                {cultivar.programs && cultivar.programs.length > 0 && (
                  <div className="flex justify-between gap-3"><dt className="text-ink-muted">Program</dt><dd className="text-right">{cultivar.programs.map((p) => p.name).join(', ')}</dd></div>
                )}
              </dl>
            </div>

            <CultivarOrderCta cultivarId={cultivar.id} />
          </aside>
        </div>
      </div>
    </article>
  );
}
