import { useCallback, useEffect, useId, useRef, useState } from 'react';
import {
  autocompletePlaces,
  newPlacesSession,
  placeDetails,
  placesEnabled,
  type PlaceAddress,
  type PlaceSuggestion,
} from '../lib/places';

interface Props {
  value: string;
  onChange: (value: string) => void;
  onPick: (address: PlaceAddress) => void;
  placeholder?: string;
  className?: string;
}

const DEBOUNCE_MS = 300;

/**
 * Street-address input that suggests Australian addresses as you type; a pick
 * hands back the address split into parts. With lookup not set up on the
 * server it is a plain input. Same behaviour as HHjsFrontEnd's
 * components/address/AddressAutocomplete.tsx, in this site's styling.
 */
export default function AddressAutocomplete({ value, onChange, onPick, placeholder, className }: Props) {
  const listId = useId();
  const [enabled, setEnabled] = useState(false);
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [busy, setBusy] = useState(false);
  const session = useRef(newPlacesSession());
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    placesEnabled().then((on) => { if (!cancelled) setEnabled(on); });
    return () => { cancelled = true; };
  }, []);

  // Only text the customer typed is looked up, never a value a pick filled in.
  useEffect(() => {
    const q = query.trim();
    if (!enabled || q.length < 3) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      autocompletePlaces(q, session.current)
        .then((list) => {
          if (cancelled) return;
          setSuggestions(list);
          setActive(-1);
          setOpen(list.length > 0);
        })
        .catch(() => { if (!cancelled) setSuggestions([]); });
    }, DEBOUNCE_MS);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [query, enabled]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (container.current && !container.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const pick = useCallback(async (s: PlaceSuggestion) => {
    setOpen(false);
    setBusy(true);
    try {
      onPick(await placeDetails(s.place_id, session.current));
    } catch {
      // Keep what was typed; the fields still take it by hand.
    } finally {
      setBusy(false);
      setQuery('');
      setSuggestions([]);
      session.current = newPlacesSession();
    }
  }, [onPick]);

  const showList = enabled && open && suggestions.length > 0;

  return (
    <div ref={container} className="relative">
      <input
        value={value}
        onChange={(e) => { onChange(e.target.value); setQuery(e.target.value); }}
        onFocus={() => { if (suggestions.length > 0) setOpen(true); }}
        onKeyDown={(e) => {
          if (!showList) return;
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => (i + 1) % suggestions.length); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => (i <= 0 ? suggestions.length - 1 : i - 1)); }
          else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); void pick(suggestions[active]); }
          else if (e.key === 'Escape') setOpen(false);
        }}
        placeholder={placeholder}
        autoComplete={enabled ? 'off' : 'address-line1'}
        role={enabled ? 'combobox' : undefined}
        aria-autocomplete={enabled ? 'list' : undefined}
        aria-expanded={enabled ? showList : undefined}
        aria-controls={enabled ? listId : undefined}
        aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
        aria-busy={busy || undefined}
        className={className}
      />
      {showList && (
        <div className="absolute left-0 right-0 z-20 mt-1 overflow-hidden rounded-sm border border-stone-200 bg-white shadow-lg">
          <ul id={listId} role="listbox" className="max-h-60 overflow-y-auto">
            {suggestions.map((s, i) => (
              <li
                key={s.place_id}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                // mousedown: the input's blur would otherwise close the list first.
                onMouseDown={(e) => { e.preventDefault(); void pick(s); }}
                onMouseEnter={() => setActive(i)}
                className={`cursor-pointer border-b border-stone-100 px-2 py-1.5 text-sm last:border-b-0 ${i === active ? 'bg-accent-50' : ''}`}
              >
                <span className="block break-words">{s.main}</span>
                {s.secondary && <span className="block break-words text-xs text-ink-muted">{s.secondary}</span>}
              </li>
            ))}
          </ul>
          {/* Google's terms require attribution on Places results shown without a Google map. */}
          <p className="border-t border-stone-100 bg-stone-50 px-2 py-0.5 text-right text-[10px] text-ink-muted">Powered by Google</p>
        </div>
      )}
    </div>
  );
}
