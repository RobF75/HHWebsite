import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useSite } from '../context/SiteContext';

/**
 * A page only some sites have. The shop (sign-in, ordering, accounts) is ours
 * until the Sales module; the harvest calendar reads our published records
 * only. On any other site these go home.
 */
export default function RequireSite({ feature, children }: { feature: 'shop' | 'platform'; children: ReactNode }) {
  const site = useSite();
  const has = feature === 'shop' ? site.shop : site.is_platform_site;
  return has ? <>{children}</> : <Navigate to="/" replace />;
}
