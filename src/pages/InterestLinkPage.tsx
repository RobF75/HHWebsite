import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { answerInterestQuestion, confirmInterest, getInterestLink, withdrawInterest } from '../lib/api';
import type { InterestView, InterestViewLine } from '../lib/types';
import { useSite } from '../context/SiteContext';

/**
 * The grower's link (emailed when it sends an expression of interest): confirm
 * it, read the licensor's answer and questions, answer one, or withdraw. The
 * token in the address is the only credential.
 */

const STATUS_TEXT: Record<InterestView['status'], string> = {
  unconfirmed: 'Not confirmed yet',
  submitted: 'With the licensor',
  question: 'The licensor has a question',
  approved: 'Answered',
  declined: 'Answered',
  withdrawn: 'Withdrawn',
};

const when = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
};

function nurseryAsked(l: InterestViewLine) {
  if (l.nursery_choice === 'self') return 'Your own trees';
  if (l.nursery_choice === 'no_preference') return 'No preference';
  return l.nursery_text || '';
}

function LineRow({ line }: { line: InterestViewLine }) {
  return (
    <li className="py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-medium">
          {line.trees.toLocaleString('en-AU')} {line.cultivar_name}
          {line.rootstock ? <span className="text-ink-muted font-normal"> on {line.rootstock}</span> : null}
        </p>
        {line.decision === 'approved' && (
          <span className="rounded-sm border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs text-emerald-800">Approved</span>
        )}
        {line.decision === 'declined' && (
          <span className="rounded-sm border border-stone-200 bg-stone-100 px-2 py-0.5 text-xs text-stone-700">Not approved</span>
        )}
      </div>
      <p className="text-sm text-ink-muted">
        {[line.tree_type, `Nursery: ${nurseryAsked(line)}`].filter(Boolean).join(' · ')}
      </p>
      {line.decision === 'approved' && (
        <p className="mt-1 text-sm text-emerald-900">
          Approved for {(line.approved_trees ?? line.trees).toLocaleString('en-AU')} trees
          {line.approved_season ? `, ${line.approved_season}` : ''}
          {line.nursery ? `, from ${line.nursery}` : ''}.
        </p>
      )}
      {line.decision === 'declined' && line.decline_reason && (
        <p className="mt-1 text-sm text-stone-700">{line.decline_reason}</p>
      )}
    </li>
  );
}

export default function InterestLinkPage() {
  const { token = '' } = useParams();
  const site = useSite();
  const [view, setView] = useState<InterestView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);
  const [reason, setReason] = useState('');

  const load = useCallback(() => {
    getInterestLink(token)
      .then((v) => { setView(v); setError(null); })
      .catch((e) => setError(e instanceof Error ? e.message : 'This link could not be opened.'));
  }, [token]);

  useEffect(() => { load(); }, [load]);

  async function act(fn: () => Promise<InterestView>) {
    setBusy(true);
    setError(null);
    try {
      setView(await fn());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That did not work. Try again.');
    } finally {
      setBusy(false);
    }
  }

  if (!view) {
    return (
      <div className="container-prose py-16">
        <h1 className="font-serif text-4xl tracking-tightish">Your interest</h1>
        {error ? <p className="mt-6 text-red-700">{error}</p> : <p className="mt-6 text-ink-muted">Loading…</p>}
      </div>
    );
  }

  const licensor = view.licensor_name || site.name;
  const answered = view.status === 'approved' || view.status === 'declined';

  return (
    <div className="container-prose py-16">
      <p className="text-[11px] uppercase tracking-[0.22em] text-accent-700 mb-4">Expression of interest</p>
      <h1 className="font-serif text-4xl tracking-tightish leading-[1.05]">{view.business_name}</h1>
      <p className="mt-2 text-sm text-ink-muted">
        Sent {when(view.created_at)} to {licensor} · <strong className="text-ink">{STATUS_TEXT[view.status]}</strong>
      </p>

      {error && <p className="mt-6 rounded-sm border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}

      {view.status === 'unconfirmed' && (
        <div className="mt-8 rounded-sm border border-accent-200 bg-accent-50 p-6">
          {view.confirm_expired ? (
            <p className="text-sm">This interest was not confirmed in time. <Link to="/interest/new" className="underline">Send it again</Link>.</p>
          ) : (
            <>
              <p className="text-sm">Confirm your interest and {licensor} will receive it.</p>
              <button type="button" disabled={busy} onClick={() => act(() => confirmInterest(token))}
                className="mt-4 inline-flex bg-ink text-stone-50 px-5 py-2.5 rounded-sm text-sm hover:opacity-90 disabled:opacity-60">
                Confirm my interest
              </button>
            </>
          )}
        </div>
      )}

      {view.status === 'submitted' && (
        <p className="mt-8 rounded-sm border border-stone-200 bg-stone-50 px-4 py-3 text-sm">
          {licensor} has your interest and will answer by email. This page shows the answer too.
        </p>
      )}

      {answered && (
        <div className="mt-8 rounded-sm border border-stone-200 bg-white p-6">
          <h2 className="font-serif text-xl">{licensor}'s answer</h2>
          {view.answer_message && <p className="mt-3 whitespace-pre-line text-sm leading-relaxed">{view.answer_message}</p>}
          {view.status === 'approved' && (
            <p className="mt-3 text-sm text-ink-muted">
              {licensor} will send you the agreements to sign before any trees are supplied.
            </p>
          )}
        </div>
      )}

      <section className="mt-8 rounded-sm border border-stone-200 bg-white p-6">
        <h2 className="font-serif text-xl mb-2">What you asked for</h2>
        <ul className="divide-y divide-stone-200">
          {view.lines.map((l) => <LineRow key={l.id} line={l} />)}
        </ul>
        <dl className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
          {view.farm_name && <><dt className="text-ink-muted">Farm</dt><dd>{view.farm_name}</dd></>}
          {(view.address || view.region) && <><dt className="text-ink-muted">Where</dt><dd>{[view.address, view.region].filter(Boolean).join(', ')}</dd></>}
          {view.hectares != null && <><dt className="text-ink-muted">Hectares</dt><dd>{view.hectares}</dd></>}
          {view.planting_season && <><dt className="text-ink-muted">Planting</dt><dd>{view.planting_season}</dd></>}
        </dl>
      </section>

      {view.thread.some((t) => t.kind === 'question' || t.kind === 'answer') && (
        <section className="mt-8 rounded-sm border border-stone-200 bg-white p-6">
          <h2 className="font-serif text-xl mb-3">Questions</h2>
          <ul className="space-y-3">
            {view.thread.filter((t) => t.kind === 'question' || t.kind === 'answer').map((t, i) => (
              <li key={i} className={`rounded-sm px-4 py-3 text-sm ${t.by_grower ? 'bg-stone-50' : 'bg-accent-50'}`}>
                <p className="text-xs text-ink-muted">{t.by_grower ? 'You' : licensor} · {when(t.created_at)}</p>
                <p className="mt-1 whitespace-pre-line">{t.body}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {view.can_answer && (
        <section className="mt-8 rounded-sm border border-accent-200 bg-accent-50 p-6">
          <label htmlFor="answer" className="block font-serif text-xl mb-3">Your answer</label>
          <textarea id="answer" className="w-full min-h-[110px] rounded-sm border border-stone-300 bg-white px-3 py-2 text-sm"
            value={answer} onChange={(e) => setAnswer(e.target.value)} />
          <button type="button" disabled={busy || !answer.trim()}
            onClick={() => act(async () => { const v = await answerInterestQuestion(token, answer); setAnswer(''); return v; })}
            className="mt-3 inline-flex bg-ink text-stone-50 px-5 py-2.5 rounded-sm text-sm hover:opacity-90 disabled:opacity-60">
            Send answer
          </button>
        </section>
      )}

      {view.can_withdraw && (
        <div className="mt-10">
          {!withdrawing ? (
            <button type="button" className="text-sm underline text-ink-muted" onClick={() => setWithdrawing(true)}>
              Withdraw my interest
            </button>
          ) : (
            <div className="rounded-sm border border-stone-200 bg-white p-4">
              <label htmlFor="reason" className="block text-sm mb-2">Why (optional)</label>
              <input id="reason" className="w-full rounded-sm border border-stone-300 px-3 py-2 text-sm"
                value={reason} onChange={(e) => setReason(e.target.value)} />
              <div className="mt-3 flex flex-wrap gap-3">
                <button type="button" disabled={busy} onClick={() => act(() => withdrawInterest(token, reason))}
                  className="bg-ink text-stone-50 px-4 py-2 rounded-sm text-sm disabled:opacity-60">
                  Withdraw it
                </button>
                <button type="button" className="text-sm underline" onClick={() => setWithdrawing(false)}>Keep it</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
