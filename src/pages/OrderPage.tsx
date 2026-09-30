import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { catalogKey, getCatalog, getMyAddresses, lineRef, placeOrder, quoteDelivery, saveMyAddress } from '../lib/storefront';
import type { DeliveryQuote, SavedAddress } from '../lib/storefront';
import type { CatalogItem } from '../lib/types';
import { useAuth } from '../context/AuthContext';
import PbrMark from '../components/PbrMark';
import AddressAutocomplete from '../components/AddressAutocomplete';
import type { PlaceAddress } from '../lib/places';
import PbrNotice from '../components/PbrNotice';
import { isPbrProtected } from '../lib/pbr';

function money(n: number) {
  return n.toLocaleString('en-AU', { style: 'currency', currency: 'AUD' });
}

function itemLabel(it: CatalogItem) {
  const name = it.cultivar_trade_name || it.cultivar_name;
  const root = it.rootstock_name ? ` on ${it.rootstock_name}` : '';
  return `${name}${root}`;
}

// Effective per-unit price for a given quantity: the highest volume break whose
// threshold the quantity meets, else the base tier price. Mirrors the server's
// resolveUnitPriceForTier so the basket total matches what's charged.
function unitPriceFor(it: CatalogItem, qty: number): number {
  const q = Math.max(qty, 1);
  if (it.price_breaks && it.price_breaks.length > 0) {
    const applicable = it.price_breaks
      .filter((b) => b.min_quantity <= q)
      .sort((a, b) => b.min_quantity - a.min_quantity)[0];
    if (applicable) return applicable.unit_price;
  }
  return it.unit_price;
}

const AU_STATES = ['VIC', 'NSW', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'];

const FIELD = 'w-full rounded-sm border border-stone-300 px-2 py-1.5 text-sm focus:border-accent-700 focus:outline-none';

// Same alphabet and shape the server checks: 4RJ7+2V, 4RJ74RJ7+2V, or a short
// code followed by a locality.
const PLUS_CODE = /^[2-9CFGHJMPQRVWX]{2,8}\+[2-9CFGHJMPQRVWX]{0,3}(?:[\s,]+.+)?$/i;

interface AddressDraft {
  label: string;
  line1: string;
  line2: string;
  suburb: string;
  state: string;
  plus_code: string;
  instructions: string;
}

const EMPTY_DRAFT: AddressDraft = { label: '', line1: '', line2: '', suburb: '', state: 'VIC', plus_code: '', instructions: '' };

const draftHasContent = (d: AddressDraft) =>
  [d.line1, d.line2, d.suburb, d.plus_code, d.instructions].some((v) => v.trim());

/** Why a typed address can't be ordered against yet, or null. Mirrors the server's save rules. */
function checkDraft(d: AddressDraft, postcode: string): string | null {
  if (!d.line1.trim() && !d.plus_code.trim()) return 'Enter a street address or a plus code.';
  if (!d.suburb.trim()) return 'Enter the suburb or town.';
  if (!/^\d{4}$/.test(postcode.trim())) return 'Enter a 4-digit postcode.';
  if (d.plus_code.trim() && !PLUS_CODE.test(d.plus_code.trim())) return 'That plus code doesn’t look right — it looks like 4RJ7+2V.';
  return null;
}

/**
 * The order's delivery-address text for an address that is not being saved.
 * A saved one gets this text from the server (orderAddressText in
 * HHNodeServer/src/utils/nurseryAddress.js); keep the two alike.
 */
function draftOrderText(d: AddressDraft, postcode: string): string {
  const locality = [d.suburb, d.state, postcode].map((v) => v.trim()).filter(Boolean).join(' ');
  const plus = d.plus_code.trim().toUpperCase();
  const first = [d.line1.trim() ? '' : plus, d.line1, d.line2, locality].map((v) => v.trim()).filter(Boolean).join(', ');
  const lines = [first];
  if (plus && d.line1.trim()) lines.push(`Plus code: ${plus}`);
  if (d.instructions.trim()) lines.push(`Instructions: ${d.instructions.trim()}`);
  return lines.join('\n');
}

export default function OrderPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const cultivarParam = searchParams.get('cultivar');
  const cultivarFilter = cultivarParam ? Number(cultivarParam) : null;

  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Keyed by catalogKey(): a stock item and a product can share an id.
  const [qty, setQty] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Fulfilment
  const [fulfilment, setFulfilment] = useState<'pickup' | 'delivery'>('pickup');
  // Drives the delivery quote, whichever way the address was chosen.
  const [postcode, setPostcode] = useState('');
  const [quotes, setQuotes] = useState<DeliveryQuote[]>([]);
  const [quoting, setQuoting] = useState(false);

  // Addresses the buyer's nurseries already hold. '' = typing a new one.
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [savedId, setSavedId] = useState<string>('');
  const [draft, setDraft] = useState<AddressDraft>(EMPTY_DRAFT);
  const [saveAddress, setSaveAddress] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getMyAddresses()
      .then((list) => { if (!cancelled) setSavedAddresses(list); })
      .catch(() => { /* none to offer; typing an address still works */ });
    return () => { cancelled = true; };
  }, []);

  const selectedSaved = savedAddresses.find((a) => String(a.id) === savedId) ?? null;

  function chooseSaved(id: string) {
    setSavedId(id);
    const a = savedAddresses.find((x) => String(x.id) === id);
    setPostcode(a ? a.postcode ?? '' : '');
    if (!a) setDraft(EMPTY_DRAFT);
  }

  function editDraft(patch: Partial<AddressDraft>) {
    setDraft((d) => ({ ...d, ...patch }));
  }

  function fillFromPlace(a: PlaceAddress) {
    setDraft((d) => ({
      ...d,
      line1: a.line1 ?? '',
      line2: a.line2 ?? d.line2,
      suburb: a.suburb ?? '',
      state: a.state && AU_STATES.includes(a.state) ? a.state : d.state,
      // No street number (a rural road, a named property): the driver needs
      // the exact spot, so take Google's plus code — never over a typed one.
      plus_code: !a.has_street_number && a.plus_code && !d.plus_code.trim() ? a.plus_code : d.plus_code,
    }));
    setPostcode(a.postcode ?? '');
  }

  function chooseFulfilment(method: 'pickup' | 'delivery') {
    setFulfilment(method);
    // First switch to delivery with nothing typed: start on the default
    // saved address rather than an empty form.
    if (method === 'delivery' && !savedId && !postcode.trim() && !draftHasContent(draft)) {
      const def = savedAddresses.find((a) => a.is_default) ?? savedAddresses[0];
      if (def) chooseSaved(String(def.id));
    }
  }

  const draftProblem = fulfilment === 'delivery' && !selectedSaved ? checkDraft(draft, postcode) : null;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getCatalog(cultivarFilter ?? undefined)
      .then((data) => {
        if (!cancelled) setItems(data);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Failed to load catalogue');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [cultivarFilter]);

  // A product's row carries its own name, not the cultivar's, so name the
  // filter from a stock item row when there is one.
  const filterItem = items.find((it) => !it.product_id) ?? null;
  const filterName = cultivarFilter && filterItem ? (filterItem.cultivar_trade_name || filterItem.cultivar_name) : null;

  function setQuantity(id: string, value: string) {
    const n = Math.max(0, Math.floor(Number(value) || 0));
    setQty((q) => ({ ...q, [id]: n }));
  }

  const lines = useMemo(
    () => items.filter((it) => (qty[catalogKey(it)] ?? 0) > 0),
    [items, qty]
  );

  const total = useMemo(
    () => lines.reduce((sum, it) => sum + unitPriceFor(it, qty[catalogKey(it)] ?? 0) * (qty[catalogKey(it)] ?? 0), 0),
    [lines, qty]
  );

  // The customer's tier (consistent across a single-nursery catalogue).
  const tierName = items.find((it) => it.tier_name)?.tier_name ?? null;

  // Quote delivery whenever the basket / postcode / method changes (debounced).
  const lineKey = lines.map((it) => `${catalogKey(it)}:${qty[catalogKey(it)]}`).join(',');
  useEffect(() => {
    if (fulfilment !== 'delivery' || lines.length === 0 || postcode.trim().length < 3) {
      setQuotes([]);
      return;
    }
    let cancelled = false;
    setQuoting(true);
    const timer = setTimeout(() => {
      quoteDelivery({
        lines: lines.map((it) => ({ ...lineRef(it), quantity_ordered: qty[catalogKey(it)] })),
        fulfilment_method: 'delivery',
        delivery_postcode: postcode.trim(),
      })
        .then((q) => { if (!cancelled) setQuotes(q); })
        .catch(() => { if (!cancelled) setQuotes([]); })
        .finally(() => { if (!cancelled) setQuoting(false); });
    }, 400);
    return () => { cancelled = true; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fulfilment, postcode, lineKey]);

  const deliveryFee = useMemo(
    () => (fulfilment === 'delivery' ? quotes.reduce((sum, q) => sum + (q.available ? q.fee : 0), 0) : 0),
    [fulfilment, quotes]
  );
  const deliveryUnavailable = fulfilment === 'delivery' && quotes.length > 0 && quotes.some((q) => !q.available);
  const grandTotal = total + deliveryFee;

  const totalTrees = useMemo(
    () => lines.reduce((sum, it) => sum + (qty[catalogKey(it)] ?? 0), 0),
    [lines, qty]
  );

  async function submit() {
    setSubmitError(null);
    setSubmitting(true);
    try {
      let deliveryAddress: string | undefined;
      if (fulfilment === 'delivery') {
        if (selectedSaved) {
          deliveryAddress = selectedSaved.order_text;
        } else if (saveAddress) {
          // Save first, so the order carries exactly what was saved. A failure
          // stops here rather than quietly ordering without saving.
          let saved: SavedAddress;
          try {
            ({ address: saved } = await saveMyAddress({
              stock_item_ids: lines.flatMap((it) => (it.product_id || it.stock_item_id == null ? [] : [it.stock_item_id])),
              product_ids: lines.flatMap((it) => (it.product_id ? [it.product_id] : [])),
              address: { ...draft, postcode: postcode.trim() },
            }));
          } catch (err) {
            const why = err instanceof Error ? err.message : 'unknown error';
            setSubmitError(`Couldn't save the address: ${why}. Untick “Save this address” to order without saving it.`);
            return;
          }
          // Select it, so a retry after a failed order does not save it again.
          setSavedAddresses((list) => (list.some((a) => a.id === saved.id) ? list : [...list, saved]));
          setSavedId(String(saved.id));
          setSaveAddress(false);
          deliveryAddress = saved.order_text;
        } else {
          deliveryAddress = draftOrderText(draft, postcode);
        }
      }
      const result = await placeOrder({
        lines: lines.map((it) => ({ ...lineRef(it), quantity_ordered: qty[catalogKey(it)] })),
        notes: notes.trim() || undefined,
        requested_delivery_date: deliveryDate || undefined,
        fulfilment_method: fulfilment,
        delivery_postcode: fulfilment === 'delivery' ? postcode.trim() : undefined,
        delivery_address: deliveryAddress || undefined,
      });
      // Retail: redirect to Stripe Checkout. Wholesale: straight to the orders page.
      if (result.checkout_url) {
        window.location.href = result.checkout_url;
        return;
      }
      navigate('/account/orders', { state: { placed: result.orders.length, paymentPending: result.payment_pending } });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Could not place order');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="container-prose py-16">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-accent-700 mb-4">Place an order</p>
          <h1 className="font-serif text-4xl md:text-5xl tracking-tightish leading-[1.05]">Order trees</h1>
          {user?.organisation_name && (
            <p className="mt-3 text-sm text-ink-muted">
              Ordering as {user.organisation_name}
              {tierName && <span className="ml-2 inline-flex items-center rounded-sm border border-accent-200 bg-accent-50 px-2 py-0.5 text-xs text-accent-800">{tierName} pricing</span>}
            </p>
          )}
        </div>
      </div>

      {!user?.email_verified && (
        <div className="mt-8 rounded-sm border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Please verify your email address — check your inbox for the verification link.
        </div>
      )}

      {cultivarFilter && (
        <div className="mt-8 flex items-center justify-between gap-3 rounded-sm border border-stone-200 bg-stone-50 px-4 py-2.5 text-sm">
          <span className="text-ink-muted">
            Showing {filterName ? <span className="text-ink font-medium">{filterName}</span> : 'one cultivar'} only.
          </span>
          <Link to="/order" className="text-accent-700 underline">Show full catalogue</Link>
        </div>
      )}

      {loading && <p className="mt-12 text-ink-muted">Loading catalogue…</p>}
      {loadError && <p className="mt-12 text-red-700">{loadError}</p>}

      {!loading && !loadError && items.length === 0 && (
        <p className="mt-12 text-ink-muted">No stock is currently available to order online. Please check back soon.</p>
      )}

      {!loading && items.length > 0 && (
        <>
        <div className="mt-10 grid grid-cols-1 lg:grid-cols-[1fr_20rem] gap-10 items-start">
          {/* Catalogue */}
          <div className="divide-y divide-stone-200 border-y border-stone-200">
            {items.map((it) => {
              const key = catalogKey(it);
              const n = qty[key] ?? 0;
              const price = unitPriceFor(it, n);
              const hasBreaks = it.price_breaks && it.price_breaks.length > 1;
              const discounted = price < it.list_price;
              return (
                <div key={key} className="flex items-center gap-4 py-4">
                  <div className="min-w-0 flex-1">
                    <div className="font-serif text-lg leading-snug">
                      {itemLabel(it)}
                      <PbrMark status={it.cultivar_protection_status} />
                    </div>
                    <div className="text-xs text-ink-muted mt-0.5">
                      {it.tree_type_name}
                      {it.species_name ? ` · ${it.species_name}` : ''}
                      {it.sku_code ? ` · ${it.sku_code}` : ''}
                      {hasBreaks ? ' · volume pricing' : ''}
                    </div>
                  </div>
                  <div className="w-24 text-right text-sm tabular-nums">
                    {money(price)}
                    {discounted && (
                      <span className="block text-[11px] text-ink-muted line-through">{money(it.list_price)}</span>
                    )}
                  </div>
                  <input
                    type="number"
                    min={0}
                    value={n || ''}
                    placeholder="0"
                    onChange={(e) => setQuantity(key, e.target.value)}
                    className="w-20 rounded-sm border border-stone-300 px-2 py-1.5 text-sm text-right focus:border-accent-700 focus:outline-none"
                  />
                </div>
              );
            })}
          </div>

          {/* Summary */}
          <aside className="lg:sticky lg:top-28 rounded-sm border border-stone-200 bg-white p-5">
            <h2 className="font-serif text-xl mb-4">Your order</h2>
            {lines.length === 0 ? (
              <p className="text-sm text-ink-muted">Enter quantities to build your order.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {lines.map((it) => (
                  <li key={catalogKey(it)} className="flex justify-between gap-3">
                    <span className="text-ink-muted truncate">{qty[catalogKey(it)]} × {itemLabel(it)}</span>
                    <span className="tabular-nums">{money(unitPriceFor(it, qty[catalogKey(it)]) * qty[catalogKey(it)])}</span>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-4 border-t border-stone-200 pt-4 space-y-1.5 text-sm">
              <div className="flex justify-between text-ink-muted">
                <span>{totalTrees} tree{totalTrees === 1 ? '' : 's'}</span>
                <span className="tabular-nums">{money(total)}</span>
              </div>
              {fulfilment === 'delivery' && (
                <div className="flex justify-between text-ink-muted">
                  <span>Delivery{quoting ? '…' : ''}</span>
                  <span className="tabular-nums">{deliveryUnavailable ? '—' : money(deliveryFee)}</span>
                </div>
              )}
              <div className="flex justify-between font-medium border-t border-stone-100 pt-1.5">
                <span>Total</span>
                <span className="tabular-nums">{money(grandTotal)}</span>
              </div>
            </div>

            {/* Fulfilment */}
            <div className="mt-5">
              <span className="block text-xs text-ink-muted mb-1.5">Fulfilment</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => chooseFulfilment('pickup')}
                  className={`flex-1 rounded-sm border px-3 py-2 text-sm transition-colors ${fulfilment === 'pickup' ? 'border-accent-700 bg-accent-50 text-accent-800' : 'border-stone-300 text-ink-muted hover:border-stone-400'}`}
                >
                  Pickup (free)
                </button>
                <button
                  type="button"
                  onClick={() => chooseFulfilment('delivery')}
                  className={`flex-1 rounded-sm border px-3 py-2 text-sm transition-colors ${fulfilment === 'delivery' ? 'border-accent-700 bg-accent-50 text-accent-800' : 'border-stone-300 text-ink-muted hover:border-stone-400'}`}
                >
                  Delivery
                </button>
              </div>
              {fulfilment === 'delivery' && (
                <div className="mt-3 space-y-2">
                  {savedAddresses.length > 0 && (
                    <label className="block">
                      <span className="block text-xs text-ink-muted mb-1">Deliver to</span>
                      <select
                        value={savedId}
                        onChange={(e) => chooseSaved(e.target.value)}
                        className="w-full rounded-sm border border-stone-300 bg-white px-2 py-1.5 text-sm focus:border-accent-700 focus:outline-none"
                      >
                        {savedAddresses.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.label ? `${a.label} — ${a.summary}` : a.summary}
                          </option>
                        ))}
                        <option value="">A different address…</option>
                      </select>
                    </label>
                  )}
                  {selectedSaved ? (
                    <p className="whitespace-pre-line break-words rounded-sm border border-stone-200 bg-stone-50 px-2 py-1.5 text-sm text-ink-muted">
                      {selectedSaved.order_text}
                    </p>
                  ) : (
                    <>
                      <AddressAutocomplete
                        value={draft.line1}
                        onChange={(line1) => editDraft({ line1 })}
                        onPick={fillFromPlace}
                        placeholder="Start typing your street address"
                        className={FIELD}
                      />
                      <input
                        value={draft.line2}
                        onChange={(e) => editDraft({ line2: e.target.value })}
                        placeholder="Unit, shed or gate (optional)"
                        autoComplete="address-line2"
                        className={FIELD}
                      />
                      <input
                        value={draft.suburb}
                        onChange={(e) => editDraft({ suburb: e.target.value })}
                        placeholder="Suburb or town"
                        autoComplete="address-level2"
                        className={FIELD}
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={draft.state}
                          onChange={(e) => editDraft({ state: e.target.value })}
                          autoComplete="address-level1"
                          aria-label="State"
                          className={`${FIELD} bg-white`}
                        >
                          {AU_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <input
                          value={postcode}
                          onChange={(e) => setPostcode(e.target.value)}
                          placeholder="Postcode"
                          inputMode="numeric"
                          maxLength={4}
                          autoComplete="postal-code"
                          className={FIELD}
                        />
                      </div>
                      <input
                        value={draft.plus_code}
                        onChange={(e) => editDraft({ plus_code: e.target.value })}
                        placeholder="Google Maps plus code (optional)"
                        className={`${FIELD} uppercase placeholder:normal-case`}
                      />
                      <p className="text-[11px] leading-snug text-ink-muted">
                        For a spot the street address doesn’t find — drop a pin in Google Maps and copy the code shown with it.
                      </p>
                      <textarea
                        rows={2}
                        value={draft.instructions}
                        onChange={(e) => editDraft({ instructions: e.target.value })}
                        placeholder="Delivery instructions — gate code, where to unload (optional)"
                        className={FIELD}
                      />
                      <label className="flex items-start gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={saveAddress}
                          onChange={(e) => setSaveAddress(e.target.checked)}
                          className="mt-0.5"
                        />
                        <span>Save this address for next time</span>
                      </label>
                      {saveAddress && (
                        <input
                          value={draft.label}
                          onChange={(e) => editDraft({ label: e.target.value })}
                          placeholder="Name it, e.g. Home block (optional)"
                          maxLength={100}
                          className={FIELD}
                        />
                      )}
                      {draftProblem && draftHasContent(draft) && (
                        <p className="text-xs text-ink-muted">{draftProblem}</p>
                      )}
                    </>
                  )}
                  {deliveryUnavailable && (
                    <p className="text-xs text-red-700">Delivery isn't available to that postcode — please choose pickup or contact us.</p>
                  )}
                </div>
              )}
            </div>

            <label className="mt-5 block">
              <span className="block text-xs text-ink-muted mb-1">Requested delivery date</span>
              <input
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                className="w-full rounded-sm border border-stone-300 px-2 py-1.5 text-sm focus:border-accent-700 focus:outline-none"
              />
            </label>
            <label className="mt-3 block">
              <span className="block text-xs text-ink-muted mb-1">Notes</span>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-sm border border-stone-300 px-2 py-1.5 text-sm focus:border-accent-700 focus:outline-none"
              />
            </label>

            {submitError && <p className="mt-3 text-sm text-red-700">{submitError}</p>}

            <button
              type="button"
              disabled={
                lines.length === 0 ||
                submitting ||
                (fulfilment === 'delivery' && (postcode.trim().length < 3 || draftProblem !== null || deliveryUnavailable || quoting))
              }
              onClick={submit}
              className="mt-4 w-full rounded-sm bg-accent-700 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-800 disabled:opacity-50"
            >
              {submitting ? 'Submitting…' : 'Submit order request'}
            </button>
            <p className="mt-3 text-xs text-ink-muted leading-relaxed">
              Submitting creates a draft order request. Our team will confirm availability and delivery.
            </p>
          </aside>
        </div>
        <PbrNotice
          show={items.some((it) => isPbrProtected(it.cultivar_protection_status))}
          className="mt-8"
        />
        </>
      )}
    </div>
  );
}
