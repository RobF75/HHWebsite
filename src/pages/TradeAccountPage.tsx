import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  applyForTradeAccount,
  getCatalog,
  getMyTradeAccountRequests,
  getNurseryTradeTiers,
} from '../lib/storefront';
import type { TradeAccountRequest, TradeTier } from '../lib/types';
import { useAuth } from '../context/AuthContext';

interface NurseryOption {
  id: number;
  name: string;
}

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-800 border-amber-200',
  approved: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  declined: 'bg-stone-100 text-stone-600 border-stone-200',
};

export default function TradeAccountPage() {
  const { user } = useAuth();

  const [nurseries, setNurseries] = useState<NurseryOption[]>([]);
  const [requests, setRequests] = useState<TradeAccountRequest[]>([]);
  const [tiers, setTiers] = useState<TradeTier[]>([]);
  const [loading, setLoading] = useState(true);

  const [nurseryId, setNurseryId] = useState<number | ''>('');
  const [tierId, setTierId] = useState<number | ''>('');
  const [businessName, setBusinessName] = useState(user?.organisation_name ?? '');
  const [abn, setAbn] = useState('');
  const [phone, setPhone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [notes, setNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Discover nurseries from the catalogue + load existing applications.
  useEffect(() => {
    let cancelled = false;
    Promise.all([getCatalog(), getMyTradeAccountRequests()])
      .then(([catalog, reqs]) => {
        if (cancelled) return;
        const seen = new Map<number, string>();
        for (const it of catalog) seen.set(it.nursery_org_id, it.nursery_name);
        setNurseries([...seen.entries()].map(([id, name]) => ({ id, name })));
        setRequests(reqs);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Load the chosen nursery's wholesale tiers.
  useEffect(() => {
    setTierId('');
    if (nurseryId === '') {
      setTiers([]);
      return;
    }
    let cancelled = false;
    getNurseryTradeTiers(Number(nurseryId))
      .then((data) => {
        if (!cancelled) setTiers(data);
      })
      .catch(() => {
        if (!cancelled) setTiers([]);
      });
    return () => {
      cancelled = true;
    };
  }, [nurseryId]);

  const pendingNurseryIds = useMemo(
    () => new Set(requests.filter((r) => r.status === 'pending').map((r) => r.organisation_id)),
    [requests]
  );

  async function submit() {
    setError(null);
    if (nurseryId === '' || !businessName.trim()) {
      setError('Please choose a nursery and enter your business name.');
      return;
    }
    setSubmitting(true);
    try {
      const created = await applyForTradeAccount({
        nursery_org_id: Number(nurseryId),
        requested_tier_id: tierId === '' ? null : Number(tierId),
        business_name: businessName.trim(),
        abn: abn.trim() || undefined,
        phone: phone.trim() || undefined,
        delivery_address: deliveryAddress.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      setRequests((r) => [created, ...r]);
      setSuccess(true);
      setNurseryId('');
      setBusinessName(user?.organisation_name ?? '');
      setAbn('');
      setPhone('');
      setDeliveryAddress('');
      setNotes('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit application');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="container-prose py-16">
      <p className="text-[11px] uppercase tracking-[0.22em] text-accent-700 mb-4">Wholesale</p>
      <h1 className="font-serif text-4xl md:text-5xl tracking-tightish leading-[1.05]">Trade account</h1>
      <p className="mt-3 max-w-prose text-sm text-ink-muted leading-relaxed">
        Garden centres and commercial growers can apply for a wholesale trade account to access
        trade pricing and bulk delivery. Your application is reviewed by the nursery before pricing
        is unlocked.
      </p>

      {loading && <p className="mt-12 text-ink-muted">Loading…</p>}

      {!loading && (
        <div className="mt-10 grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
          {/* Application form */}
          <div className="rounded-sm border border-stone-200 bg-white p-6">
            <h2 className="font-serif text-xl mb-4">Apply</h2>

            {success && (
              <div className="mb-4 rounded-sm border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                Application submitted. We'll be in touch once it's reviewed.
              </div>
            )}

            <label className="block mb-3">
              <span className="block text-xs text-ink-muted mb-1">Nursery</span>
              <select
                value={nurseryId}
                onChange={(e) => setNurseryId(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full rounded-sm border border-stone-300 px-2 py-1.5 text-sm focus:border-accent-700 focus:outline-none"
              >
                <option value="">Choose a nursery…</option>
                {nurseries.map((n) => (
                  <option key={n.id} value={n.id} disabled={pendingNurseryIds.has(n.id)}>
                    {n.name}{pendingNurseryIds.has(n.id) ? ' — application pending' : ''}
                  </option>
                ))}
              </select>
            </label>

            {tiers.length > 0 && (
              <label className="block mb-3">
                <span className="block text-xs text-ink-muted mb-1">Account type</span>
                <select
                  value={tierId}
                  onChange={(e) => setTierId(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full rounded-sm border border-stone-300 px-2 py-1.5 text-sm focus:border-accent-700 focus:outline-none"
                >
                  <option value="">No preference</option>
                  {tiers.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </label>
            )}

            <label className="block mb-3">
              <span className="block text-xs text-ink-muted mb-1">Business name</span>
              <input
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="w-full rounded-sm border border-stone-300 px-2 py-1.5 text-sm focus:border-accent-700 focus:outline-none"
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block mb-3">
                <span className="block text-xs text-ink-muted mb-1">ABN</span>
                <input
                  value={abn}
                  onChange={(e) => setAbn(e.target.value)}
                  className="w-full rounded-sm border border-stone-300 px-2 py-1.5 text-sm focus:border-accent-700 focus:outline-none"
                />
              </label>
              <label className="block mb-3">
                <span className="block text-xs text-ink-muted mb-1">Phone</span>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded-sm border border-stone-300 px-2 py-1.5 text-sm focus:border-accent-700 focus:outline-none"
                />
              </label>
            </div>

            <label className="block mb-3">
              <span className="block text-xs text-ink-muted mb-1">Delivery address</span>
              <textarea
                rows={2}
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                className="w-full rounded-sm border border-stone-300 px-2 py-1.5 text-sm focus:border-accent-700 focus:outline-none"
              />
            </label>

            <label className="block mb-3">
              <span className="block text-xs text-ink-muted mb-1">Notes</span>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-sm border border-stone-300 px-2 py-1.5 text-sm focus:border-accent-700 focus:outline-none"
              />
            </label>

            {error && <p className="mb-3 text-sm text-red-700">{error}</p>}

            <button
              type="button"
              disabled={submitting}
              onClick={submit}
              className="w-full rounded-sm bg-accent-700 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-800 disabled:opacity-50"
            >
              {submitting ? 'Submitting…' : 'Submit application'}
            </button>
          </div>

          {/* Existing applications */}
          <div>
            <h2 className="font-serif text-xl mb-4">Your applications</h2>
            {requests.length === 0 ? (
              <p className="text-sm text-ink-muted">
                You haven't applied yet. In the meantime you can <Link to="/order" className="text-accent-700 underline">order at retail pricing</Link>.
              </p>
            ) : (
              <ul className="space-y-3">
                {requests.map((r) => (
                  <li key={r.id} className="rounded-sm border border-stone-200 bg-white p-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium">{r.business_name}</span>
                      <span className={`rounded-sm border px-2 py-0.5 text-xs capitalize ${STATUS_STYLES[r.status] ?? ''}`}>
                        {r.status}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-ink-muted">
                      {r.requested_tier_name ? `Requested: ${r.requested_tier_name}` : 'No tier preference'}
                      {r.granted_tier_name ? ` · Granted: ${r.granted_tier_name}` : ''}
                    </div>
                    {r.review_notes && <p className="mt-2 text-xs text-ink-muted">{r.review_notes}</p>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
