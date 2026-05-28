import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { getMyOrders } from '../lib/storefront';
import type { MyOrder } from '../lib/types';

function money(v: string | null) {
  const n = Number(v ?? 0);
  return n.toLocaleString('en-AU', { style: 'currency', currency: 'AUD' });
}

const STATUS_LABEL: Record<string, string> = {
  draft: 'Submitted',
  confirmed: 'Confirmed',
  allocated: 'Allocated',
  partially_allocated: 'Partially allocated',
  picking: 'Picking',
  picked: 'Picked',
  shipped: 'Shipped',
  invoiced: 'Invoiced',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export default function MyOrdersPage() {
  const location = useLocation();
  const placed = (location.state as { placed?: number } | null)?.placed;

  const [orders, setOrders] = useState<MyOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getMyOrders()
      .then((data) => {
        if (!cancelled) setOrders(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load orders');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="container-prose py-16">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-accent-700 mb-4">Account</p>
          <h1 className="font-serif text-4xl md:text-5xl tracking-tightish leading-[1.05]">Your orders</h1>
        </div>
        <Link
          to="/order"
          className="rounded-sm border border-accent-700 px-4 py-2 text-sm text-accent-700 transition-colors hover:bg-accent-50"
        >
          New order
        </Link>
      </div>

      {placed ? (
        <div className="mt-8 rounded-sm border border-accent-200 bg-accent-50 px-4 py-3 text-sm text-accent-800">
          Thank you — your order request has been submitted. We'll be in touch to confirm.
        </div>
      ) : null}

      {loading && <p className="mt-12 text-ink-muted">Loading…</p>}
      {error && <p className="mt-12 text-red-700">{error}</p>}

      {!loading && !error && orders.length === 0 && (
        <p className="mt-12 text-ink-muted">
          You haven't placed any orders yet. <Link to="/order" className="text-accent-700 underline">Start an order</Link>.
        </p>
      )}

      {orders.length > 0 && (
        <div className="mt-10 overflow-x-auto border-y border-stone-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-[0.14em] text-ink-muted">
                <th className="py-3 pr-4 font-normal">Order</th>
                <th className="py-3 pr-4 font-normal">Nursery</th>
                <th className="py-3 pr-4 font-normal">Date</th>
                <th className="py-3 pr-4 font-normal">Status</th>
                <th className="py-3 pr-4 font-normal text-right">Trees</th>
                <th className="py-3 font-normal text-right">Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200">
              {orders.map((o) => (
                <tr key={o.id}>
                  <td className="py-3 pr-4 font-medium">{o.order_number}</td>
                  <td className="py-3 pr-4 text-ink-muted">{o.nursery_name}</td>
                  <td className="py-3 pr-4 text-ink-muted tabular-nums">{o.order_date}</td>
                  <td className="py-3 pr-4">{STATUS_LABEL[o.status] ?? o.status}</td>
                  <td className="py-3 pr-4 text-right tabular-nums">{o.total_trees}</td>
                  <td className="py-3 text-right tabular-nums">{money(o.total_value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
