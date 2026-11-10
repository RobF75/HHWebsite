import { Link } from 'react-router-dom';
import { useSite } from '../context/SiteContext';
import { useAuth } from '../context/AuthContext';

const BUTTON = 'inline-flex items-center gap-2 bg-ink text-stone-50 px-5 py-2.5 rounded-sm text-sm hover:bg-accent-700 transition-colors';
const BUTTON_OUTLINE = 'inline-flex items-center gap-2 border border-stone-300 px-5 py-2.5 rounded-sm text-sm text-ink hover:border-accent-700 hover:text-accent-700 transition-colors';

/**
 * Ordering a product or a supply: the price is on the Order page, for
 * signed-in trade customers. A site with no shop offers Enquire.
 */
export default function ShopOrderCta() {
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
