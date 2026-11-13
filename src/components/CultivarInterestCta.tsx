import { Link } from 'react-router-dom';

/**
 * On a licensor's site a licensed cultivar is not ordered: the grower
 * expresses interest and the licensor decides (HHjsFrontEnd
 * docs/planting-interest-plan.md). Shown in place of the order box.
 */
export default function CultivarInterestCta({ cultivarId, siteName }: { cultivarId: number; siteName: string }) {
  return (
    <div className="rounded bg-accent-50 border border-accent-200 p-6">
      <h3 className="font-serif text-lg mb-2">Want to grow this cultivar?</h3>
      <p className="text-sm text-ink-muted mb-4">
        {siteName} licenses who grows it. Tell us how many trees, where, and from which nursery, and {siteName} will
        answer. No account needed.
      </p>
      <Link
        to={`/interest/new?cultivar=${cultivarId}`}
        className="inline-flex items-center gap-2 bg-ink text-stone-50 px-5 py-2.5 rounded-sm text-sm hover:opacity-90 transition-opacity"
      >
        Express interest
      </Link>
    </div>
  );
}
