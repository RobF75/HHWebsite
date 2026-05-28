import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/order';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="container-prose py-20 max-w-md">
      <p className="text-[11px] uppercase tracking-[0.22em] text-accent-700 mb-4">Account</p>
      <h1 className="font-serif text-4xl md:text-5xl tracking-tightish leading-[1.05]">Sign in</h1>

      <form onSubmit={onSubmit} className="mt-10 space-y-5">
        {error && (
          <div className="rounded-sm border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}
        <label className="block">
          <span className="block text-sm text-ink-muted mb-1">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-sm border border-stone-300 px-3 py-2 text-sm focus:border-accent-700 focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="block text-sm text-ink-muted mb-1">Password</span>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-sm border border-stone-300 px-3 py-2 text-sm focus:border-accent-700 focus:outline-none"
          />
        </label>
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-sm bg-accent-700 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-800 disabled:opacity-60"
        >
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <p className="mt-6 text-sm text-ink-muted">
        New customer?{' '}
        <Link to="/register" className="text-accent-700 underline">Create an account</Link>
      </p>
    </div>
  );
}
