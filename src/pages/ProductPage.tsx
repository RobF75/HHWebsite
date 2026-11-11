import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getProduct, listProducts, mediaSrcSet, mediaUrl } from '../lib/api';
import type { PublicProduct, PublicProductDetail } from '../lib/types';
import { sizesOf } from '../lib/productGroups';
import PbrMark from '../components/PbrMark';
import PbrNotice from '../components/PbrNotice';
import ShopOrderCta from '../components/ShopOrderCta';
import PhotoCarousel from '../components/PhotoCarousel';
import { isPbrProtected } from '../lib/pbr';

export default function ProductPage() {
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState<PublicProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // The same variety in its other pot sizes, each a product of its own.
  const [sizes, setSizes] = useState<PublicProduct[]>([]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    getProduct(Number(id))
      .then((data) => { if (!cancelled) setProduct(data); })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  const slug = product?.crop_type_slug;
  useEffect(() => {
    if (!product || !slug) { setSizes([]); return; }
    let cancelled = false;
    // Extra: a failure just leaves the size chooser out.
    listProducts(slug)
      .then((all) => { if (!cancelled) setSizes(sizesOf(product, all)); })
      .catch(() => { if (!cancelled) setSizes([]); });
    return () => { cancelled = true; };
  }, [product, slug]);

  if (loading) {
    return <div className="container-prose py-32 text-sm text-ink-muted">Loading…</div>;
  }
  if (error || !product) {
    return (
      <div className="container-prose py-32 text-center">
        <h1 className="font-serif text-3xl mb-4">Not found</h1>
        <p className="text-ink-muted">This is not currently listed on this site.</p>
        <Link to="/" className="mt-6 inline-block text-accent-700 hover:underline">← Back to home</Link>
      </div>
    );
  }

  const hero = mediaUrl(product.hero_media_id);

  return (
    <article>
      <div className="container-prose pt-16 pb-10">
        <div className="text-[11px] uppercase tracking-[0.18em] text-accent-700 mb-4">
          {product.crop_type_name && product.crop_type_slug ? (
            <Link to={`/${product.crop_type_slug}`} className="hover:text-ink">{product.crop_type_name}</Link>
          ) : (
            product.crop_type_name
          )}
        </div>
        <h1 className="font-serif text-5xl md:text-7xl tracking-tightish leading-[1.05] break-words">{product.name}</h1>
        {sizes.length > 1 ? (
          <div className="mt-5 flex flex-wrap gap-2" aria-label="Sizes">
            {sizes.map((s) => s.id === product.id ? (
              <span key={s.id} aria-current="page" className="px-4 py-2 text-sm rounded-sm border border-ink bg-ink text-stone-50">
                {s.tree_type_name ?? 'This size'}
              </span>
            ) : (
              <Link key={s.id} to={`/product/${s.id}`} className="px-4 py-2 text-sm rounded-sm border border-stone-300 bg-white text-ink-muted hover:text-ink hover:border-ink">
                {s.tree_type_name ?? 'Other size'}
              </Link>
            ))}
          </div>
        ) : product.tree_type_name && (
          <p className="mt-4 text-xl text-ink-muted">{product.tree_type_name}</p>
        )}
      </div>

      <div className="container-prose pb-16">
        <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_17rem] lg:grid-cols-[minmax(0,1fr)_20rem] gap-10 lg:gap-12">
          {hero && (
            <div className="min-w-0">
              <PhotoCarousel
                key={product.id}
                photos={[{ src: hero, srcSet: mediaSrcSet(product.hero_media_id), alt: product.name }]}
              />
            </div>
          )}

          <aside className="md:col-start-2 md:row-start-1 md:row-span-2 md:sticky md:top-28 md:self-start space-y-8">
            <div className="rounded border border-stone-200 bg-white p-6">
              <h3 className="font-serif text-lg mb-4">At a glance</h3>
              <dl className="space-y-3 text-sm">
                {product.crop_type_name && (
                  <div className="flex justify-between gap-3"><dt className="text-ink-muted">Species</dt><dd className="text-right">{product.crop_type_name}</dd></div>
                )}
                {product.tree_type_name && (
                  <div className="flex justify-between gap-3"><dt className="text-ink-muted">Size</dt><dd className="text-right">{product.tree_type_name}</dd></div>
                )}
                {product.tag_colour_name && (
                  <div className="flex justify-between gap-3">
                    <dt className="text-ink-muted">Tag colour</dt>
                    <dd className="flex items-center gap-2 text-right">
                      {product.tag_colour_hex && (
                        <span className="inline-block h-3 w-3 rounded-full border border-stone-300" style={{ backgroundColor: product.tag_colour_hex }} />
                      )}
                      {product.tag_colour_name}
                    </dd>
                  </div>
                )}
              </dl>
            </div>
            <ShopOrderCta />
          </aside>
          <div className="min-w-0">
            {product.description && (
              <div className="prose-like text-base text-ink leading-relaxed whitespace-pre-line">
                {product.description}
              </div>
            )}
            {product.cultivars.length > 0 && (
              <section className={product.description ? 'mt-12' : ''}>
                <h2 className="font-serif text-2xl tracking-tightish mb-4">About the variety</h2>
                <ul className="space-y-2">
                  {product.cultivars.map((c) => (
                    <li key={c.id}>
                      <Link to={`/cultivar/${c.id}`} className="text-accent-700 underline hover:text-ink">
                        {c.trade_name || c.name}
                      </Link>
                      <PbrMark status={c.protection_status} />
                    </li>
                  ))}
                </ul>
                <PbrNotice
                  show={product.cultivars.some((c) => isPbrProtected(c.protection_status))}
                  className="mt-8"
                />
              </section>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
