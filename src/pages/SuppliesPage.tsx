import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { merchandiseImageUrl } from '../lib/api';
import { useMerchandise } from '../hooks/useMerchandise';
import type { PublicMerchandise } from '../lib/types';

const OTHER = 'Other supplies';

/** Groups the items under the shop's categories, in the order the server sent them. */
function byCategory(items: PublicMerchandise[]) {
  const groups: { name: string; items: PublicMerchandise[] }[] = [];
  for (const it of items) {
    const name = it.category_name || OTHER;
    let g = groups.find((x) => x.name === name);
    if (!g) {
      g = { name, items: [] };
      groups.push(g);
    }
    g.items.push(it);
  }
  return groups;
}

export function SupplyCard({ item }: { item: PublicMerchandise }) {
  const img = merchandiseImageUrl(item);
  return (
    <Link
      to={`/supplies/${item.id}`}
      className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 rounded"
    >
      <div className="aspect-square overflow-hidden rounded bg-stone-100">
        {img ? (
          <img
            src={img}
            alt={item.name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-stone-400 text-sm">No image</div>
        )}
      </div>
      <div className="mt-4">
        <h3 className="font-serif text-xl tracking-tightish break-words">{item.name}</h3>
        {item.unit && <p className="mt-1 text-xs uppercase tracking-[0.14em] text-ink-muted">{item.unit}</p>}
        {item.description && (
          <p className="mt-2 text-sm text-ink-muted leading-relaxed line-clamp-3">{item.description}</p>
        )}
      </div>
    </Link>
  );
}

/** /supplies: everything else the nursery sells, by the shop's own categories. */
export default function SuppliesPage() {
  const { items, loading, error } = useMerchandise();
  const groups = useMemo(() => byCategory(items), [items]);

  return (
    <div className="container-prose py-20">
      <p className="text-[11px] uppercase tracking-[0.22em] text-accent-700 mb-4">Supplies</p>
      <h1 className="font-serif text-5xl md:text-6xl tracking-tightish">Garden supplies</h1>
      <p className="mt-6 max-w-2xl text-lg text-ink-muted leading-relaxed">
        Fertiliser, potting mix, pots and more, to order with your trees.
      </p>

      <div className="mt-12">
        {loading ? (
          <div className="text-sm text-ink-muted">Loading…</div>
        ) : error ? (
          <div className="text-sm text-red-700">{error}</div>
        ) : items.length === 0 ? (
          <div className="text-sm text-ink-muted">No supplies to display.</div>
        ) : (
          <div className="space-y-16">
            {groups.map((g) => (
              <section key={g.name}>
                {groups.length > 1 && (
                  <h2 className="font-serif text-2xl tracking-tightish mb-8">{g.name}</h2>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-12">
                  {g.items.map((it) => <SupplyCard key={it.id} item={it} />)}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
