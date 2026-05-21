import { Link } from 'react-router-dom';
import type { PublicCultivarSummary } from '../lib/types';
import { mediaUrl } from '../lib/api';

interface Props {
  cultivar: PublicCultivarSummary;
}

export default function CultivarCard({ cultivar }: Props) {
  const hero = mediaUrl(cultivar.hero_media_id);
  return (
    <Link
      to={`/cultivar/${cultivar.id}`}
      className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 rounded"
    >
      <div className="aspect-[4/5] overflow-hidden rounded bg-stone-100">
        {hero ? (
          <img
            src={hero}
            alt={cultivar.name}
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
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="font-serif text-xl tracking-tightish">
            {cultivar.trade_name || cultivar.name}
          </h3>
          {cultivar.cultivar_role === 'rootstock' && (
            <span className="text-[10px] uppercase tracking-[0.15em] text-ink-muted">Rootstock</span>
          )}
        </div>
        {cultivar.trade_name && cultivar.name !== cultivar.trade_name && (
          <p className="text-sm text-ink-muted italic">{cultivar.name}</p>
        )}
        {cultivar.website_tagline && (
          <p className="mt-2 text-sm text-ink-muted leading-relaxed">{cultivar.website_tagline}</p>
        )}
      </div>
    </Link>
  );
}
