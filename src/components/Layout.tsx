import { Outlet, NavLink, Link, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSpecies } from '../hooks/useSpecies';
import { useAuth } from '../context/AuthContext';
import type { PublicSpecies } from '../lib/types';

interface SpeciesGroup {
  /** Parent category name, e.g. "Stone Fruit". Null = ungrouped leaves. */
  parentName: string | null;
  children: PublicSpecies[];
}

/**
 * Buckets the flat species list under their parent crop type. Species with no
 * parent (parent_id null) are returned as single-item groups so they render as
 * plain top-level nav links instead of dropdowns.
 */
function groupSpeciesByParent(species: PublicSpecies[]): SpeciesGroup[] {
  const groups = new Map<string, SpeciesGroup>();
  const ungrouped: SpeciesGroup[] = [];

  for (const s of species) {
    if (!s.parent_name) {
      ungrouped.push({ parentName: null, children: [s] });
      continue;
    }
    const existing = groups.get(s.parent_name);
    if (existing) {
      existing.children.push(s);
    } else {
      groups.set(s.parent_name, { parentName: s.parent_name, children: [s] });
    }
  }

  return [...groups.values(), ...ungrouped];
}

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

function AuthNav() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();

  if (loading) return null;

  if (!user) {
    return (
      <NavLink to="/login" className={navLinkClass}>Sign in</NavLink>
    );
  }

  async function onSignOut() {
    await logout();
    navigate('/');
  }

  return (
    <div className="flex items-center gap-6">
      <NavLink to="/order" className={navLinkClass}>Order</NavLink>
      <NavLink to="/account/orders" className={navLinkClass}>My orders</NavLink>
      <NavLink to="/account/trade" className={navLinkClass}>Trade account</NavLink>
      <button type="button" onClick={onSignOut} className="text-sm tracking-wide text-ink-muted hover:text-ink transition-colors">
        Sign out
      </button>
    </div>
  );
}

function SpeciesDropdown({ group }: { group: SpeciesGroup }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number | null>(null);
  const location = useLocation();

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  // Small delay on mouseleave so users can move diagonally from the trigger
  // into the panel without it snapping shut.
  function openNow() {
    if (closeTimer.current) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    setOpen(true);
  }
  function scheduleClose() {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setOpen(false), 120);
  }

  const isActive = group.children.some((c) => location.pathname === `/${c.slug}`);

  return (
    <div
      ref={containerRef}
      className="relative"
      onMouseEnter={openNow}
      onMouseLeave={scheduleClose}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onFocus={openNow}
        aria-haspopup="true"
        aria-expanded={open}
        className={[
          'inline-flex items-center gap-1 text-sm tracking-wide transition-colors',
          isActive ? 'text-accent-700' : 'text-ink-muted hover:text-ink',
        ].join(' ')}
      >
        {group.parentName}
        <svg
          className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 12 12"
          aria-hidden
        >
          <path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute left-1/2 top-full -translate-x-1/2 pt-3 z-40"
          onMouseEnter={openNow}
          onMouseLeave={scheduleClose}
        >
          <div className="min-w-[14rem] rounded-sm border border-stone-200 bg-white shadow-lg py-2">
            <div className="px-4 pt-1 pb-2 text-[10px] uppercase tracking-[0.22em] text-ink-muted">
              {group.parentName}
            </div>
            <ul>
              {group.children.map((s) => (
                <li key={s.id}>
                  <NavLink
                    to={`/${s.slug}`}
                    className={({ isActive: linkActive }) =>
                      [
                        'flex items-baseline justify-between gap-4 px-4 py-2 text-sm transition-colors',
                        linkActive
                          ? 'bg-stone-50 text-accent-700'
                          : 'text-ink hover:bg-stone-50 hover:text-accent-700',
                      ].join(' ')
                    }
                  >
                    <span className="font-serif">{s.name}</span>
                    <span className="text-[10px] uppercase tracking-[0.14em] text-ink-muted">
                      {s.cultivar_count}
                    </span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

function Header() {
  const { species } = useSpecies();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const groups = useMemo(() => groupSpeciesByParent(species), [species]);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  return (
    <header className="border-b border-stone-200 bg-stone-50/95 backdrop-blur sticky top-0 z-30">
      <div className="container-prose flex h-20 items-center justify-between gap-6">
        <Brand />

        <nav className="hidden md:flex items-center gap-8">
          {groups.map((g) =>
            g.parentName ? (
              <SpeciesDropdown key={g.parentName} group={g} />
            ) : (
              <NavLink key={g.children[0].id} to={`/${g.children[0].slug}`} className={navLinkClass}>
                {g.children[0].name}
              </NavLink>
            )
          )}
          <span className="h-4 w-px bg-stone-300" aria-hidden />
          <NavLink to="/about" className={navLinkClass}>About</NavLink>
          <NavLink to="/contact" className={navLinkClass}>Contact</NavLink>
          <span className="h-4 w-px bg-stone-300" aria-hidden />
          <AuthNav />
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
          <nav className="container-prose flex flex-col py-4 gap-4">
            {groups.map((g) =>
              g.parentName ? (
                <div key={g.parentName}>
                  <div className="text-[10px] uppercase tracking-[0.22em] text-ink-muted mb-2">
                    {g.parentName}
                  </div>
                  <div className="flex flex-col gap-2 pl-3 border-l border-stone-200">
                    {g.children.map((s) => (
                      <NavLink key={s.id} to={`/${s.slug}`} className={navLinkClass}>
                        {s.name}
                      </NavLink>
                    ))}
                  </div>
                </div>
              ) : (
                <NavLink key={g.children[0].id} to={`/${g.children[0].slug}`} className={navLinkClass}>
                  {g.children[0].name}
                </NavLink>
              )
            )}
            <hr className="border-stone-200" />
            <NavLink to="/about" className={navLinkClass}>About</NavLink>
            <NavLink to="/contact" className={navLinkClass}>Contact</NavLink>
            <hr className="border-stone-200" />
            <AuthNav />
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
