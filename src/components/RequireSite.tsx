import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useSite } from '../context/SiteContext';

/**
 * A page only some sites have. The shop (sign-in, ordering, accounts) is ours,
 * and an organisation's once it turns its shop on; the harvest calendar reads
 * our published records only; expressions of interest are an organisation's
 * once it turns them on. On any other site these go home.
 */
export default function RequireSite({ feature, children }: { feature: 'shop' | 'platform' | 'interests'; children: ReactNode }) {
  const site = useSite();
  const has = feature === 'shop' ? site.shop : feature === 'interests' ? site.interests === true : site.is_platform_site;
  return has ? <>{children}</> : <Navigate to="/" replace />;
}
