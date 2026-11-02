// Each deploy is a separate site with its own domain and its own VITE_APP_ROLE
// (see PUBLISHING.md):
//   customer -> www.luckyseva.in                (VITE_APP_ROLE=customer)
//   provider -> luckyseva-provider.vercel.app   (VITE_APP_ROLE=provider)
//   admin    -> admin site                      (VITE_APP_ROLE=admin)
//
// The two apps never share a login screen: a customer signs in on the customer
// site, a professional signs in on the partner site. These constants are the
// cross-links between them. Override them per Vercel project if a domain
// changes; the fallbacks below are the production values.
const trimTrailingSlash = (url: string) => url.replace(/\/+$/, '');

export const CUSTOMER_SITE_URL = trimTrailingSlash(
  import.meta.env.VITE_CUSTOMER_URL || 'https://www.luckyseva.in'
);

export const PARTNER_SITE_URL = trimTrailingSlash(
  import.meta.env.VITE_PARTNER_URL || 'https://luckyseva-provider.vercel.app'
);
