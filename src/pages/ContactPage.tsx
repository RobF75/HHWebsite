import { useSite } from '../context/SiteContext';

function TenantContact() {
  const site = useSite();
  const { contact_email: email, contact_phone: phone } = site.branding;
  return (
    <div className="container-prose py-20 max-w-3xl">
      <p className="text-[11px] uppercase tracking-[0.22em] mb-4" style={{ color: 'var(--site-primary, #344d30)' }}>Contact</p>
      <h1 className="font-serif text-5xl md:text-6xl tracking-tightish leading-[1.05]">Get in touch with {site.name}.</h1>
      <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 gap-8 text-sm">
        {email && (
          <div>
            <h3 className="font-serif text-lg mb-2">Email</h3>
            <a href={`mailto:${email}`} className="text-ink-muted underline">{email}</a>
          </div>
        )}
        {phone && (
          <div>
            <h3 className="font-serif text-lg mb-2">Phone</h3>
            <a href={`tel:${phone.replace(/[^\d+]/g, '')}`} className="text-ink-muted underline">{phone}</a>
          </div>
        )}
        {!email && !phone && <p className="text-ink-muted">Contact details are coming soon.</p>}
      </div>
    </div>
  );
}

export default function ContactPage() {
  const site = useSite();
  if (!site.is_platform_site) return <TenantContact />;
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
