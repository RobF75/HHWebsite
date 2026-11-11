import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getMerchandise, merchandiseImageUrl } from '../lib/api';
import type { PublicMerchandise } from '../lib/types';
import ShopOrderCta from '../components/ShopOrderCta';
import PhotoCarousel from '../components/PhotoCarousel';

/** /supplies/:id: one supply (a bag of fertiliser, a pot) on its own page. */
export default function SupplyPage() {
  const { id } = useParams<{ id: string }>();
  const [item, setItem] = useState<PublicMerchandise | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    getMerchandise(Number(id))
      .then((data) => { if (!cancelled) setItem(data); })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  if (loading) {
    return <div className="container-prose py-32 text-sm text-ink-muted">Loading…</div>;
  }
  if (error || !item) {
    return (
      <div className="container-prose py-32 text-center">
        <h1 className="font-serif text-3xl mb-4">Not found</h1>
        <p className="text-ink-muted">This is not currently listed on this site.</p>
        <Link to="/supplies" className="mt-6 inline-block text-accent-700 hover:underline">← All supplies</Link>
      </div>
    );
  }

  const img = merchandiseImageUrl(item);

  return (
    <article>
      <div className="container-prose pt-16 pb-10">
        <div className="text-[11px] uppercase tracking-[0.18em] text-accent-700 mb-4">
          <Link to="/supplies" className="hover:text-ink">Supplies</Link>
          {item.category_name ? ` · ${item.category_name}` : ''}
        </div>
        <h1 className="font-serif text-5xl md:text-7xl tracking-tightish leading-[1.05] break-words">{item.name}</h1>
        {item.unit && <p className="mt-4 text-xl text-ink-muted">{item.unit}</p>}
      </div>

      <div className="container-prose pb-16">
        <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_17rem] lg:grid-cols-[minmax(0,1fr)_20rem] gap-10 lg:gap-12">
          {img && (
            <div className="min-w-0">
              <PhotoCarousel key={item.id} photos={[{ src: img, alt: item.name }]} />
            </div>
          )}

          <aside className="md:col-start-2 md:row-start-1 md:row-span-2 md:sticky md:top-28 md:self-start space-y-8">
            <ShopOrderCta />
          </aside>
          <div className="min-w-0">
            {item.description && (
              <div className="prose-like text-base text-ink leading-relaxed whitespace-pre-line">
                {item.description}
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
