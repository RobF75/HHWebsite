import { Link } from 'react-router-dom';
import type { PublicProduct } from '../lib/types';
import { mediaUrl } from '../lib/api';

interface Props {
  product: PublicProduct;
}

/** A product on a species page, beside the cultivar cards. */
export default function ProductCard({ product }: Props) {
  const hero = mediaUrl(product.hero_media_id);
  return (
    <Link
      to={`/product/${product.id}`}
      className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 rounded"
    >
      <div className="aspect-[4/5] overflow-hidden rounded bg-stone-100">
        {hero ? (
          <img
            src={hero}
            alt={product.name}
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
        <h3 className="font-serif text-xl tracking-tightish break-words">{product.name}</h3>
        {product.tree_type_name && (
          <p className="mt-1 text-xs uppercase tracking-[0.14em] text-ink-muted">{product.tree_type_name}</p>
        )}
        {product.description && (
          <p className="mt-2 text-sm text-ink-muted leading-relaxed line-clamp-3">{product.description}</p>
        )}
      </div>
    </Link>
  );
}
