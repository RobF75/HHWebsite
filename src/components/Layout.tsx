import { Outlet, NavLink, Link, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useSpecies } from '../hooks/useSpecies';

function Brand() {
  return (
    <Link to="/" className="inline-flex items-baseline gap-2 group">
      <span className="font-serif text-2xl tracking-tightish text-ink">Factree</span>
      <span className="text-xs uppercase tracking-[0.18em] text-ink-muted group-hover:text-accent-700 transition-colors">
        Nursery
      </span>
    </Link>
  );
}

function navLinkClass({ isActive }: { isActive: boolean }) {
  return [
    'text-sm tracking-wide transition-colors',
    isActive ? 'text-accent-700' : 'text-ink-muted hover:text-ink',
  ].join(' ');
}

function Header() {
  const { species } = useSpecies();
  const [open, setOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  return (
    <header className="border-b border-stone-200 bg-stone-50/95 backdrop-blur sticky top-0 z-30">
      <div className="container-prose flex h-20 items-center justify-between gap-6">
        <Brand />

        <nav className="hidden md:flex items-center gap-8">
          {species.map((s) => (
            <NavLink key={s.id} to={`/${s.slug}`} className={navLinkClass}>
              {s.name}
            </NavLink>
          ))}
          <span className="h-4 w-px bg-stone-300" aria-hidden />
          <NavLink to="/about" className={navLinkClass}>About</NavLink>
          <NavLink to="/contact" className={navLinkClass}>Contact</NavLink>
        </nav>

        <button
          type="button"
          className="md:hidden inline-flex items-center justify-center h-9 w-9 rounded border border-stone-300 text-ink"
          aria-label="Toggle navigation"
          onClick={() => setOpen((v) => !v)}
        >
          <span className="sr-only">Menu</span>
          <span className="block w-4 h-px bg-current relative before:absolute before:-top-1.5 before:left-0 before:w-4 before:h-px before:bg-current after:absolute after:top-1.5 after:left-0 after:w-4 after:h-px after:bg-current" />
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t border-stone-200 bg-stone-50">
          <nav className="container-prose flex flex-col py-4 gap-3">
            {species.map((s) => (
              <NavLink key={s.id} to={`/${s.slug}`} className={navLinkClass}>
                {s.name}
              </NavLink>
            ))}
            <hr className="border-stone-200" />
            <NavLink to="/about" className={navLinkClass}>About</NavLink>
            <NavLink to="/contact" className={navLinkClass}>Contact</NavLink>
          </nav>
        </div>
      )}
    </header>
  );
}

function Footer() {
  const { species } = useSpecies();
  return (
    <footer className="mt-32 border-t border-stone-200 bg-white">
      <div className="container-prose py-16 grid grid-cols-1 md:grid-cols-4 gap-10">
        <div className="md:col-span-2">
          <Brand />
          <p className="mt-4 max-w-md text-sm text-ink-muted leading-relaxed">
            Australian commercial fruit tree nursery. We propagate proven cultivars and modern releases
            in volume for orchard developers and replant programs.
          </p>
        </div>
        <div>
          <h4 className="font-serif text-base mb-3">Cultivars</h4>
          <ul className="space-y-2 text-sm">
            {species.slice(0, 6).map((s) => (
              <li key={s.id}>
                <Link to={`/${s.slug}`} className="text-ink-muted hover:text-ink">{s.name}</Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="font-serif text-base mb-3">Company</h4>
          <ul className="space-y-2 text-sm">
            <li><Link to="/about" className="text-ink-muted hover:text-ink">About</Link></li>
            <li><Link to="/contact" className="text-ink-muted hover:text-ink">Contact</Link></li>
            <li><a href="https://tech.factree.com.au" className="text-ink-muted hover:text-ink">Grower portal</a></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-stone-200">
        <div className="container-prose py-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-ink-muted">
          <span>© {new Date().getFullYear()} Factree Pty Ltd. All rights reserved.</span>
          <span>Commercial enquiries only. Minimum order quantities apply.</span>
        </div>
      </div>
    </footer>
  );
}

export default function Layout() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
