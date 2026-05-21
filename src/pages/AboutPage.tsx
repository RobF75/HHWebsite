export default function AboutPage() {
  return (
    <div className="container-prose py-20 max-w-3xl">
      <p className="text-[11px] uppercase tracking-[0.22em] text-accent-700 mb-4">About</p>
      <h1 className="font-serif text-5xl md:text-6xl tracking-tightish leading-[1.05]">A commercial nursery, built for orchardists.</h1>

      <div className="mt-12 space-y-8 text-lg leading-relaxed text-ink-muted">
        <p>
          Factree propagates fruit tree cultivars in commercial volumes for Australian orchard developers,
          replant programs and corporate growers. We work directly with breeders, licensors and grower groups
          to source modern releases and proven heritage cultivars.
        </p>
        <p>
          Every tree we ship carries a documented provenance — cultivar, rootstock, source budwood and propagation date.
          Our data-driven approach is backed by a living cultivar registry that captures evaluator observations
          and grower performance across Australian growing regions.
        </p>
        <p>
          We do not sell retail. Minimum order quantities apply. If you're planning a planting program — get in touch.
        </p>
      </div>
    </div>
  );
}
