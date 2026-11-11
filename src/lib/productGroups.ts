import type { PublicProduct } from './types';

/**
 * A variety offered in several pot sizes is a product per size in the
 * nursery (Dwarf Eureka Lemon 200mm pot, Dwarf Eureka Lemon 250mm pot). The
 * site shows it once, with its sizes, rather than a card per size.
 */
export interface ProductGroup {
  key: string;
  name: string;
  /** One per size, smallest first. */
  products: PublicProduct[];
  /** The first size's picture, or the first one that has a picture. */
  hero_media_id: number | null;
}

/** Same name (ignoring case and spacing) on the same species. */
function groupKey(p: PublicProduct) {
  return `${p.crop_type_id ?? ''}|${p.name.trim().replace(/\s+/g, ' ').toLowerCase()}`;
}

/** Orders "200mm pot" before "250mm pot" before "1.5m standard". */
export function bySize(a: PublicProduct, b: PublicProduct) {
  return (a.tree_type_name ?? '').localeCompare(b.tree_type_name ?? '', undefined, { numeric: true })
    || a.id - b.id;
}

/** Groups products by variety, keeping the order the first of each came in. */
export function groupProducts(products: PublicProduct[]): ProductGroup[] {
  const groups = new Map<string, PublicProduct[]>();
  for (const p of products) {
    const key = groupKey(p);
    const list = groups.get(key);
    if (list) list.push(p);
    else groups.set(key, [p]);
  }
  return [...groups.entries()].map(([key, list]) => {
    const sorted = [...list].sort(bySize);
    return {
      key,
      name: sorted[0].name,
      products: sorted,
      hero_media_id: sorted.find((p) => p.hero_media_id != null)?.hero_media_id ?? null,
    };
  });
}

/** The other sizes of the same variety, the given product included. */
export function sizesOf(product: PublicProduct, products: PublicProduct[]): PublicProduct[] {
  const key = groupKey(product);
  return products.filter((p) => groupKey(p) === key).sort(bySize);
}
