import { Link } from 'react-router-dom';
import type { ProductGroup } from '../lib/productGroups';
import { CARD_SIZES, mediaSrcSet, mediaUrl } from '../lib/api';

interface Props {
  group: ProductGroup;
}

/**
 * A variety for sale on a species page, beside the cultivar cards: one card
 * for all its pot sizes, opening the smallest (its page links the others).
 */
export default function ProductCard({ group }: Props) {
  const first = group.products[0];
  const hero = mediaUrl(group.hero_media_id, 800);
  const sizes = group.products.map((p) => p.tree_type_name).filter((s): s is string => !!s);
  const description = group.products.find((p) => p.description)?.description;
  return (
    <Link
      to={`/product/${first.id}`}
      className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 rounded"
    >
      <div className="aspect-[4/5] overflow-hidden rounded bg-stone-100">
        {hero ? (
          <img
            src={hero}
            srcSet={mediaSrcSet(group.hero_media_id)}
            sizes={CARD_SIZES}
            alt={group.name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-stone-400 text-sm">
            No image
          </div>
        )}
      </div>
      <div className="mt-4">
        <h3 className="font-serif text-xl tracking-tightish break-words">{group.name}</h3>
        {sizes.length > 0 && (
          <p className="mt-1 text-xs uppercase tracking-[0.14em] text-ink-muted">{sizes.join(' · ')}</p>
        )}
        {description && (
          <p className="mt-2 text-sm text-ink-muted leading-relaxed line-clamp-3">{description}</p>
        )}
      </div>
    </Link>
  );
}
