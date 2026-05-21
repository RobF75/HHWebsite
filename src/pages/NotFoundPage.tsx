import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="container-prose py-32 text-center">
      <p className="text-[11px] uppercase tracking-[0.22em] text-accent-700 mb-4">404</p>
      <h1 className="font-serif text-5xl tracking-tightish">Page not found</h1>
      <p className="mt-4 text-ink-muted">The page you're looking for doesn't exist or has been moved.</p>
      <Link to="/" className="mt-8 inline-block text-accent-700 hover:underline">← Back to home</Link>
    </div>
  );
}
