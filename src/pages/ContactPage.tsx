export default function ContactPage() {
  return (
    <div className="container-prose py-20 max-w-3xl">
      <p className="text-[11px] uppercase tracking-[0.22em] text-accent-700 mb-4">Contact</p>
      <h1 className="font-serif text-5xl md:text-6xl tracking-tightish leading-[1.05]">Talk to us about volumes and timing.</h1>

      <p className="mt-8 text-lg text-ink-muted leading-relaxed">
        For catalogue requests, availability or grafting orders — get in touch directly.
        Online ordering for licensed growers is coming soon via the <a href="https://tech.factree.com.au" className="underline">grower portal</a>.
      </p>

      <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 gap-8 text-sm">
        <div>
          <h3 className="font-serif text-lg mb-2">Sales enquiries</h3>
          <p className="text-ink-muted">sales@factree.com.au</p>
        </div>
        <div>
          <h3 className="font-serif text-lg mb-2">Cultivar licensing</h3>
          <p className="text-ink-muted">licensing@factree.com.au</p>
        </div>
      </div>
    </div>
  );
}
