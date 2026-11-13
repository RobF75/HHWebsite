import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getInterestCultivars, sendInterest } from '../lib/api';
import type { InterestCultivars, InterestNurseryChoice } from '../lib/types';
import { useSite } from '../context/SiteContext';

/**
 * An expression of interest (HHjsFrontEnd docs/planting-interest-plan.md):
 * on a licensor's site a grower does not order a licensed cultivar, it says
 * what it would like and the licensor decides. No account is needed; the
 * emailed link confirms it, and is the grower's way back to the answer.
 */

interface LineDraft {
  key: number;
  cultivarId: string;
  rootstock: string;
  treeType: string;
  trees: string;
  choice: InterestNurseryChoice;
  nursery: string;
}

let nextKey = 1;
const blankLine = (cultivarId = ''): LineDraft => ({
  key: nextKey++, cultivarId, rootstock: '', treeType: '', trees: '', choice: 'named', nursery: '',
});

const input = 'w-full min-w-0 rounded-sm border border-stone-300 bg-white px-3 py-2 text-sm focus:border-accent-700 focus:outline-none';
const label = 'block text-xs font-medium text-ink-muted mb-1';

export default function InterestPage() {
  const site = useSite();
  const [params] = useSearchParams();
  const [choices, setChoices] = useState<InterestCultivars | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [businessName, setBusinessName] = useState('');
  const [contactName, setContactName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [abn, setAbn] = useState('');
  const [farmName, setFarmName] = useState('');
  const [address, setAddress] = useState('');
  const [region, setRegion] = useState('');
  const [hectares, setHectares] = useState('');
  const [season, setSeason] = useState('');
  const [notes, setNotes] = useState('');
  const [website, setWebsite] = useState('');
  const [lines, setLines] = useState<LineDraft[]>(() => [blankLine(params.get('cultivar') || '')]);

  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ link: string | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    getInterestCultivars()
      .then((d) => { if (!cancelled) setChoices(d); })
      .catch((e) => { if (!cancelled) setLoadError(e instanceof Error ? e.message : 'Could not load the cultivars.'); });
    return () => { cancelled = true; };
  }, []);

  // A cultivar named in the address that the site does not take interests for is dropped.
  useEffect(() => {
    if (!choices) return;
    const ok = new Set(choices.cultivars.map((c) => String(c.id)));
    setLines((ls) => ls.map((l) => (l.cultivarId && !ok.has(l.cultivarId) ? { ...l, cultivarId: '' } : l)));
  }, [choices]);

  const groups = useMemo(() => {
    const out = new Map<string, InterestCultivars['cultivars']>();
    for (const c of choices?.cultivars || []) {
      const k = c.crop_type_name || 'Other';
      out.set(k, [...(out.get(k) || []), c]);
    }
    return [...out.entries()];
  }, [choices]);

  const setLine = (key: number, patch: Partial<LineDraft>) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSending(true);
    try {
      const result = await sendInterest({
        business_name: businessName,
        contact_name: contactName,
        email,
        phone: phone || undefined,
        abn: abn || undefined,
        farm_name: farmName || undefined,
        address: address || undefined,
        region: region || undefined,
        hectares: hectares ? Number(hectares) : null,
        planting_season: season || undefined,
        notes: notes || undefined,
        website,
        lines: lines.map((l) => ({
          cultivar_id: Number(l.cultivarId),
          rootstock: l.rootstock || undefined,
          tree_type: l.treeType || undefined,
          trees: Number(l.trees),
          nursery_choice: l.choice,
          nursery_text: l.choice === 'named' ? l.nursery : undefined,
        })),
      });
      setDone({ link: result.link });
      window.scrollTo({ top: 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Your interest could not be sent.');
    } finally {
      setSending(false);
    }
  }

  if (done) {
    return (
      <div className="container-prose py-16">
        <h1 className="font-serif text-4xl tracking-tightish">Check your email</h1>
        <p className="mt-4 max-w-prose text-ink leading-relaxed">
          We have emailed <strong>{email}</strong> a link. Open it to confirm your interest, and {site.name} will
          receive it. Keep the email: the same link shows {site.name}'s answer and any questions.
        </p>
        {done.link && (
          <p className="mt-4 rounded-sm border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            This server does not send email.{' '}
            <a href={done.link} className="underline break-all">Open your link</a> to confirm.
          </p>
        )}
        <Link to="/" className="mt-8 inline-block text-sm underline">Back to {site.name}</Link>
      </div>
    );
  }

  return (
    <div className="container-prose py-16">
      <p className="text-[11px] uppercase tracking-[0.22em] text-accent-700 mb-4">Growers</p>
      <h1 className="font-serif text-4xl md:text-5xl tracking-tightish leading-[1.05]">Express interest</h1>
      <p className="mt-3 max-w-prose text-sm text-ink-muted leading-relaxed">
        {site.name} licenses who grows its cultivars. Tell us what you would like to plant, where, and from which
        nursery. {site.name} reviews it and answers; nothing is ordered and nobody is committed until agreements
        are signed.
      </p>

      {loadError && <p className="mt-8 text-sm text-red-700">{loadError}</p>}
      {!choices && !loadError && <p className="mt-8 text-ink-muted">Loading…</p>}
      {choices && choices.cultivars.length === 0 && (
        <p className="mt-8 text-ink-muted">{site.name} is not taking expressions of interest for any cultivar just now.</p>
      )}

      {choices && choices.cultivars.length > 0 && (
        <form onSubmit={submit} className="mt-10 space-y-8">
          <section className="rounded-sm border border-stone-200 bg-white p-6">
            <h2 className="font-serif text-xl mb-4">What you would like to plant</h2>
            <div className="space-y-5">
              {lines.map((l, i) => (
                <div key={l.key} className="rounded-sm border border-stone-200 p-4">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <p className="text-sm font-medium">Cultivar {i + 1}</p>
                    {lines.length > 1 && (
                      <button type="button" className="text-xs underline text-ink-muted"
                        onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}>
                        Remove
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="min-w-0">
                      <label className={label} htmlFor={`cv-${l.key}`}>Cultivar</label>
                      <select id={`cv-${l.key}`} className={input} required value={l.cultivarId}
                        onChange={(e) => setLine(l.key, { cultivarId: e.target.value })}>
                        <option value="">Choose…</option>
                        {groups.map(([crop, cs]) => (
                          <optgroup key={crop} label={crop}>
                            {cs.map((c) => (
                              <option key={c.id} value={c.id}>{c.name}{c.trade_name ? ` (${c.trade_name})` : ''}</option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </div>
                    <div className="min-w-0">
                      <label className={label} htmlFor={`tr-${l.key}`}>Number of trees</label>
                      <input id={`tr-${l.key}`} className={input} required inputMode="numeric" value={l.trees}
                        onChange={(e) => setLine(l.key, { trees: e.target.value.replace(/[^\d]/g, '') })} />
                    </div>
                    <div className="min-w-0">
                      <label className={label} htmlFor={`rs-${l.key}`}>Rootstock (if you know it)</label>
                      <input id={`rs-${l.key}`} className={input} list={`rs-list-${l.key}`} value={l.rootstock}
                        onChange={(e) => setLine(l.key, { rootstock: e.target.value })} />
                      <datalist id={`rs-list-${l.key}`}>
                        {choices.rootstocks.map((r) => <option key={r} value={r} />)}
                      </datalist>
                    </div>
                    <div className="min-w-0">
                      <label className={label} htmlFor={`tt-${l.key}`}>Tree type (bare-root, potted…)</label>
                      <input id={`tt-${l.key}`} className={input} value={l.treeType}
                        onChange={(e) => setLine(l.key, { treeType: e.target.value })} />
                    </div>
                  </div>
                  <fieldset className="mt-4">
                    <legend className={label}>Which nursery would supply them?</legend>
                    <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
                      {([['named', 'A nursery I name'], ['no_preference', 'No preference'], ['self', "We'll propagate them ourselves"]] as const)
                        .map(([v, text]) => (
                          <label key={v} className="inline-flex items-center gap-2">
                            <input type="radio" name={`ch-${l.key}`} checked={l.choice === v}
                              onChange={() => setLine(l.key, { choice: v })} />
                            {text}
                          </label>
                        ))}
                    </div>
                    {l.choice === 'named' && (
                      <div className="mt-3 min-w-0">
                        <label className={label} htmlFor={`ns-${l.key}`}>Nursery</label>
                        <input id={`ns-${l.key}`} className={input} required value={l.nursery}
                          placeholder="The nursery's name"
                          onChange={(e) => setLine(l.key, { nursery: e.target.value })} />
                      </div>
                    )}
                  </fieldset>
                </div>
              ))}
            </div>
            <button type="button" className="mt-4 text-sm underline"
              onClick={() => setLines((ls) => [...ls, blankLine()])}>
              Add another cultivar
            </button>
          </section>

          <section className="rounded-sm border border-stone-200 bg-white p-6">
            <h2 className="font-serif text-xl mb-4">Where and when</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="min-w-0">
                <label className={label} htmlFor="farm">Farm or orchard name</label>
                <input id="farm" className={input} value={farmName} onChange={(e) => setFarmName(e.target.value)} />
              </div>
              <div className="min-w-0">
                <label className={label} htmlFor="region">Growing region</label>
                <input id="region" className={input} value={region} placeholder="Goulburn Valley"
                  onChange={(e) => setRegion(e.target.value)} />
              </div>
              <div className="min-w-0 sm:col-span-2">
                <label className={label} htmlFor="address">Address</label>
                <input id="address" className={input} value={address} onChange={(e) => setAddress(e.target.value)} />
              </div>
              <div className="min-w-0">
                <label className={label} htmlFor="ha">Hectares to plant</label>
                <input id="ha" className={input} inputMode="decimal" value={hectares}
                  onChange={(e) => setHectares(e.target.value.replace(/[^\d.]/g, ''))} />
              </div>
              <div className="min-w-0">
                <label className={label} htmlFor="season">Planting season</label>
                <input id="season" className={input} value={season} placeholder="Winter 2027"
                  onChange={(e) => setSeason(e.target.value)} />
              </div>
            </div>
            <p className="mt-2 text-xs text-ink-muted">An address or a growing region is needed.</p>
          </section>

          <section className="rounded-sm border border-stone-200 bg-white p-6">
            <h2 className="font-serif text-xl mb-4">About you</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="min-w-0">
                <label className={label} htmlFor="biz">Business name</label>
                <input id="biz" className={input} required value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
              </div>
              <div className="min-w-0">
                <label className={label} htmlFor="abn">ABN</label>
                <input id="abn" className={input} value={abn} onChange={(e) => setAbn(e.target.value)} />
              </div>
              <div className="min-w-0">
                <label className={label} htmlFor="name">Your name</label>
                <input id="name" className={input} required autoComplete="name" value={contactName}
                  onChange={(e) => setContactName(e.target.value)} />
              </div>
              <div className="min-w-0">
                <label className={label} htmlFor="phone">Phone</label>
                <input id="phone" className={input} autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <div className="min-w-0 sm:col-span-2">
                <label className={label} htmlFor="email">Email</label>
                <input id="email" type="email" className={input} required autoComplete="email" value={email}
                  onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="min-w-0 sm:col-span-2">
                <label className={label} htmlFor="notes">Anything else {site.name} should know</label>
                <textarea id="notes" className={`${input} min-h-[90px]`} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
            </div>
            {/* Hidden from people; a script filling every field fills it. */}
            <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
              <label htmlFor="website">Website</label>
              <input id="website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
            </div>
          </section>

          <p className="max-w-prose text-xs text-ink-muted leading-relaxed">
            This is not an order and commits nobody to anything. {site.name} sees what you send here. If it approves,
            the nursery you named may be contacted about supplying the trees. See the{' '}
            <a href="https://tech.factree.com.au/privacy" className="underline" target="_blank" rel="noreferrer">privacy policy</a>.
          </p>

          {error && <p className="rounded-sm border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}

          <button type="submit" disabled={sending}
            className="inline-flex items-center gap-2 bg-ink text-stone-50 px-6 py-3 rounded-sm text-sm hover:opacity-90 disabled:opacity-60">
            {sending ? 'Sending…' : 'Send my interest'}
          </button>
        </form>
      )}
    </div>
  );
}
