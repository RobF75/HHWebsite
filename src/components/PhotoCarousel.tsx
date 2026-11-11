import { useCallback, useEffect, useRef, useState } from 'react';

export interface CarouselPhoto {
  src: string;
  alt: string;
  caption?: string | null;
}

interface PhotoCarouselProps {
  photos: CarouselPhoto[];
  /** Milliseconds between slides; 0 turns the automatic advance off. */
  interval?: number;
}

/**
 * The photos on a cultivar, product or supply page. One photo is shown as it
 * is; more than one is a slide show (arrows, dots, swipe, arrow keys, and an
 * automatic advance that stops while the reader is pointing at it or has
 * asked for reduced motion).
 *
 * The box has a fixed shape (4:3) and the photo is fitted inside it, so the
 * page is laid out the same before, during and after a photo loads, whatever
 * size the photo was uploaded at.
 */
export default function PhotoCarousel({ photos, interval = 6000 }: PhotoCarouselProps) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchX = useRef<number | null>(null);
  const count = photos.length;
  const many = count > 1;

  // Give it a `key` per page, so another page's photos start at the first.
  const go = useCallback((to: number) => setIndex(((to % count) + count) % count), [count]);

  useEffect(() => {
    if (!many || paused || interval <= 0) return;
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const id = window.setTimeout(() => setIndex((i) => (i + 1) % count), interval);
    return () => window.clearTimeout(id);
  }, [many, paused, interval, count, index]);

  if (count === 0) return null;
  const current = photos[Math.min(index, count - 1)];

  return (
    <figure
      className="m-0"
      aria-roledescription={many ? 'carousel' : undefined}
      aria-label={many ? 'Photos' : undefined}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onKeyDown={(e) => {
        if (!many) return;
        if (e.key === 'ArrowLeft') { e.preventDefault(); go(index - 1); }
        if (e.key === 'ArrowRight') { e.preventDefault(); go(index + 1); }
      }}
    >
      <div
        className="relative aspect-[4/3] w-full overflow-hidden rounded bg-stone-100"
        onTouchStart={(e) => { touchX.current = e.touches[0]?.clientX ?? null; setPaused(true); }}
        onTouchEnd={(e) => {
          const start = touchX.current;
          touchX.current = null;
          const end = e.changedTouches[0]?.clientX;
          if (!many || start == null || end == null) return;
          const dx = end - start;
          if (Math.abs(dx) > 40) go(dx < 0 ? index + 1 : index - 1);
        }}
      >
        {photos.map((p, i) => (
          <img
            key={`${p.src}-${i}`}
            src={p.src}
            alt={p.alt}
            loading={i === 0 ? 'eager' : 'lazy'}
            decoding="async"
            aria-hidden={i !== index}
            className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-500 ${
              i === index ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
          />
        ))}

        {many && (
          <>
            <button
              type="button"
              onClick={() => go(index - 1)}
              aria-label="Previous photo"
              className="absolute left-2 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white/85 text-ink shadow hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-700"
            >
              <span aria-hidden="true" className="text-xl leading-none">‹</span>
            </button>
            <button
              type="button"
              onClick={() => go(index + 1)}
              aria-label="Next photo"
              className="absolute right-2 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white/85 text-ink shadow hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-700"
            >
              <span aria-hidden="true" className="text-xl leading-none">›</span>
            </button>
            <div className="absolute bottom-2 right-3 rounded-full bg-white/85 px-2 py-0.5 text-xs text-ink" aria-live="polite">
              {index + 1} / {count}
            </div>
          </>
        )}
      </div>

      {(current.caption || many) && (
        <div className="mt-3 flex items-start justify-between gap-4">
          <figcaption className="text-sm text-ink-muted min-w-0">{current.caption || ''}</figcaption>
          {many && (
            <div className="flex shrink-0 flex-wrap justify-end gap-1.5" role="group" aria-label="Choose a photo">
              {photos.map((p, i) => (
                <button
                  key={`dot-${p.src}-${i}`}
                  type="button"
                  onClick={() => go(i)}
                  aria-label={`Photo ${i + 1} of ${count}`}
                  aria-current={i === index ? 'true' : undefined}
                  className="flex h-6 w-6 items-center justify-center"
                >
                  <span className={`block h-2 w-2 rounded-full ${i === index ? 'bg-ink' : 'bg-stone-300'}`} />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </figure>
  );
}
