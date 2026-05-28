import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

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

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await register({
        business_name: form.business_name.trim(),
        contact_name: form.contact_name.trim() || undefined,
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        password: form.password,
        customer_number: form.customer_number.trim() || undefined,
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

  return (
    <div className="container-prose py-20 max-w-md">
      <p className="text-[11px] uppercase tracking-[0.22em] text-accent-700 mb-4">Account</p>
      <h1 className="font-serif text-4xl md:text-5xl tracking-tightish leading-[1.05]">Create an account</h1>
      <p className="mt-4 text-sm text-ink-muted leading-relaxed">
        For trade customers. If you already deal with us, add your existing customer number and
        we'll connect your account to your records.
      </p>

      <form onSubmit={onSubmit} className="mt-10 space-y-5">
        {error && (
          <div className="rounded-sm border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}
        <label className="block">
          <span className="block text-sm text-ink-muted mb-1">Business name</span>
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
        <label className="block">
          <span className="block text-sm text-ink-muted mb-1">Existing customer number <span className="text-ink-muted/70">(optional)</span></span>
          <input value={form.customer_number} onChange={(e) => set('customer_number', e.target.value)} className={fieldClass} />
        </label>
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
