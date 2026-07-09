import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { lookupCustomer, type CustomerType } from '../lib/auth';

const TYPE_OPTIONS: { value: CustomerType; title: string; blurb: string }[] = [
  {
    value: 'grower',
    title: 'Commercial grower',
    blurb: 'Orchards and farms buying trees at trade pricing.',
  },
  {
    value: 'garden_centre',
    title: 'Garden centre or nursery',
    blurb: 'Retail nurseries and garden centres buying wholesale to resell.',
  },
  {
    value: 'retail',
    title: 'Buying direct',
    blurb: 'Home gardeners and individuals ordering for themselves.',
  },
];

const isTrade = (t: CustomerType | null) => t === 'grower' || t === 'garden_centre';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [customerType, setCustomerType] = useState<CustomerType | null>(null);
  const [form, setForm] = useState({
    business_name: '',
    contact_name: '',
    email: '',
    phone: '',
    password: '',
    customer_number: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Legacy customer-number lookup (grower / garden-centre only).
  const [lookupState, setLookupState] = useState<'idle' | 'loading' | 'matched' | 'nomatch' | 'error'>('idle');
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [matchedName, setMatchedName] = useState<string | null>(null);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    // Any change to the lookup inputs invalidates a previous match.
    if (key === 'customer_number' || key === 'email') {
      setLookupState('idle');
      setLookupError(null);
      setMatchedName(null);
    }
  }

  async function onLookup() {
    const custNo = form.customer_number.trim();
    const em = form.email.trim();
    if (!custNo || !em) return;
    setLookupState('loading');
    setLookupError(null);
    try {
      const r = await lookupCustomer(custNo, em);
      if (r.matched) {
        setLookupState('matched');
        setMatchedName(r.business_name || null);
        // Prefill from the record, but never clobber what the customer already typed.
        setForm((f) => ({
          ...f,
          business_name: f.business_name.trim() ? f.business_name : (r.business_name || ''),
          contact_name: f.contact_name.trim() ? f.contact_name : (r.contact_first_name || ''),
        }));
      } else {
        setLookupState('nomatch');
      }
    } catch (e) {
      setLookupState('error');
      setLookupError(e instanceof Error ? e.message : 'Lookup failed');
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!customerType) return;
    setError(null);
    setSubmitting(true);
    try {
      await register({
        business_name: form.business_name.trim(),
        contact_name: form.contact_name.trim() || undefined,
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        password: form.password,
        customer_number: isTrade(customerType) ? form.customer_number.trim() || undefined : undefined,
        customer_type: customerType,
      });
      navigate('/order', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  }

  const fieldClass =
    'w-full rounded-sm border border-stone-300 px-3 py-2 text-sm focus:border-accent-700 focus:outline-none';

  // Step 1 — choose the kind of customer before showing the form.
  if (!customerType) {
    return (
      <div className="container-prose py-20 max-w-md">
        <p className="text-[11px] uppercase tracking-[0.22em] text-accent-700 mb-4">Account</p>
        <h1 className="font-serif text-4xl md:text-5xl tracking-tightish leading-[1.05]">Create an account</h1>
        <p className="mt-4 text-sm text-ink-muted leading-relaxed">Tell us who's ordering so we can set you up correctly.</p>

        <div className="mt-10 space-y-3">
          {TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setCustomerType(opt.value)}
              className="w-full rounded-sm border border-stone-300 px-4 py-4 text-left transition-colors hover:border-accent-700 hover:bg-accent-50/40"
            >
              <span className="block text-sm font-medium text-ink">{opt.title}</span>
              <span className="mt-0.5 block text-xs text-ink-muted">{opt.blurb}</span>
            </button>
          ))}
        </div>

        <p className="mt-6 text-sm text-ink-muted">
          Already have an account?{' '}
          <Link to="/login" className="text-accent-700 underline">Sign in</Link>
        </p>
      </div>
    );
  }

  const trade = isTrade(customerType);
  const selected = TYPE_OPTIONS.find((o) => o.value === customerType)!;

  return (
    <div className="container-prose py-20 max-w-md">
      <p className="text-[11px] uppercase tracking-[0.22em] text-accent-700 mb-4">Account</p>
      <h1 className="font-serif text-4xl md:text-5xl tracking-tightish leading-[1.05]">Create an account</h1>

      <div className="mt-4 flex items-center justify-between gap-3 rounded-sm border border-stone-200 bg-stone-50 px-4 py-2.5">
        <span className="text-sm text-ink">{selected.title}</span>
        <button
          type="button"
          onClick={() => setCustomerType(null)}
          className="text-xs text-accent-700 underline"
        >
          Change
        </button>
      </div>

      {trade && (
        <p className="mt-4 text-sm text-ink-muted leading-relaxed">
          If you already deal with us, add your existing customer number and email and we'll connect your account to
          your records.
        </p>
      )}

      <form onSubmit={onSubmit} className="mt-10 space-y-5">
        {error && (
          <div className="rounded-sm border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}
        <label className="block">
          <span className="block text-sm text-ink-muted mb-1">{trade ? 'Business name' : 'Your name'}</span>
          <input required value={form.business_name} onChange={(e) => set('business_name', e.target.value)} className={fieldClass} />
        </label>
        <label className="block">
          <span className="block text-sm text-ink-muted mb-1">Contact name</span>
          <input value={form.contact_name} onChange={(e) => set('contact_name', e.target.value)} className={fieldClass} />
        </label>
        <label className="block">
          <span className="block text-sm text-ink-muted mb-1">Email</span>
          <input type="email" required value={form.email} onChange={(e) => set('email', e.target.value)} className={fieldClass} />
        </label>
        <label className="block">
          <span className="block text-sm text-ink-muted mb-1">Phone</span>
          <input value={form.phone} onChange={(e) => set('phone', e.target.value)} className={fieldClass} />
        </label>
        <label className="block">
          <span className="block text-sm text-ink-muted mb-1">Password</span>
          <input type="password" required minLength={8} value={form.password} onChange={(e) => set('password', e.target.value)} className={fieldClass} />
          <span className="mt-1 block text-xs text-ink-muted">At least 8 characters.</span>
        </label>
        {trade && (
          <div className="space-y-2">
            <label className="block">
              <span className="block text-sm text-ink-muted mb-1">Existing customer number <span className="text-ink-muted/70">(optional)</span></span>
              <input value={form.customer_number} onChange={(e) => set('customer_number', e.target.value)} className={fieldClass} />
            </label>
            <button
              type="button"
              onClick={onLookup}
              disabled={lookupState === 'loading' || !form.customer_number.trim() || !form.email.trim()}
              className="rounded-sm border border-accent-700 px-3 py-1.5 text-sm text-accent-700 transition-colors hover:bg-accent-50 disabled:opacity-50"
            >
              {lookupState === 'loading' ? 'Checking…' : 'Find my account'}
            </button>
            <span className="ml-2 text-xs text-ink-muted">Uses the email above to match your records.</span>
            {lookupState === 'matched' && (
              <div className="rounded-sm border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                Found{matchedName ? `: ${matchedName}` : ''} — we'll connect your account to your records.
              </div>
            )}
            {lookupState === 'nomatch' && (
              <div className="rounded-sm border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                We couldn't match that customer number and email. Check they're correct, or create your account anyway
                and we'll link it to your records manually.
              </div>
            )}
            {lookupState === 'error' && (
              <div className="rounded-sm border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{lookupError}</div>
            )}
          </div>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-sm bg-accent-700 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-800 disabled:opacity-60"
        >
          {submitting ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      <p className="mt-6 text-sm text-ink-muted">
        Already have an account?{' '}
        <Link to="/login" className="text-accent-700 underline">Sign in</Link>
      </p>
    </div>
  );
}
