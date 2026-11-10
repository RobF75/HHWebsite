import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getProduct, mediaUrl } from '../lib/api';
import type { PublicProductDetail } from '../lib/types';
import { useSite } from '../context/SiteContext';
import { useAuth } from '../context/AuthContext';
import PbrMark from '../components/PbrMark';
import PbrNotice from '../components/PbrNotice';
import { isPbrProtected } from '../lib/pbr';

const BUTTON = 'inline-flex items-center gap-2 bg-ink text-stone-50 px-5 py-2.5 rounded-sm text-sm hover:bg-accent-700 transition-colors';
const BUTTON_OUTLINE = 'inline-flex items-center gap-2 border border-stone-300 px-5 py-2.5 rounded-sm text-sm text-ink hover:border-accent-700 hover:text-accent-700 transition-colors';

/** Ordering: the price is on the Order page, for signed-in trade customers. */
function ProductOrderCta() {
  const site = useSite();
  const { user } = useAuth();
  if (!site.shop) {
    return (
      <div className="rounded bg-stone-100 border border-stone-200 p-6">
        <h3 className="font-serif text-lg mb-2">Interested in this?</h3>
        <p className="text-sm text-ink-muted mb-4">Ask {site.name} about availability and pricing.</p>
        <Link to="/contact" className={BUTTON}>Enquire</Link>
      </div>
    );
  }
  return (
    <div className="rounded bg-accent-50 border border-accent-200 p-6">
      <h3 className="font-serif text-lg mb-2">Order this</h3>
      <p className="text-sm text-ink-muted mb-4">
        {user
          ? 'Trade customers order online. Prices and availability are on the order page.'
          : 'Trade customers can order online. Sign in to see availability and pricing.'}
      </p>
      <div className="flex flex-wrap gap-3">
        {user ? (
          <Link to="/order" className={BUTTON}>Order now</Link>
        ) : (
          <Link to="/login" state={{ from: '/order' }} className={BUTTON}>Sign in to order</Link>
        )}
        <Link to="/contact" className={BUTTON_OUTLINE}>Enquire</Link>
      </div>
      {!user && (
        <p className="mt-3 text-xs text-ink-muted">
          New customer? <Link to="/register" className="underline">Create an account</Link>
        </p>
      )}
    </div>
  );
}

export default function ProductPage() {
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState<PublicProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        {product.tree_type_name && (
          <p className="mt-4 text-xl text-ink-muted">{product.tree_type_name}</p>
        )}
      </div>

      {hero && (
        <div className="container-prose">
          <div className="overflow-hidden rounded bg-stone-100 flex justify-center">
            <img src={hero} alt={product.name} className="max-h-[70vh] w-auto object-contain" />
          </div>
        </div>
      )}

      <div className="container-prose py-16">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          <div className="lg:col-span-2">
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

          <aside className="lg:sticky lg:top-28 lg:self-start space-y-8">
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
            <ProductOrderCta />
          </aside>
        </div>
      </div>
    </article>
  );
}
