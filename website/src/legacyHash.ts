/** The site used hash routing until October 2026 (/#/merkle). Old links
 * and bookmarks still arrive in that form, so before the router reads the
 * URL they are rewritten in place to the clean path (/merkle).
 *
 * Only fragments that start with "#/" are routes; ordinary in-page anchors
 * (#modules) are left alone. Query strings from both sides of the hash are
 * kept: "/?classic=1#/" and "/#/?classic=1" both become "/?classic=1".
 * The rewrite removes the "#/" it matched on, so it can never loop. */
export function legacyHashTarget(href: string): string | null {
  const url = new URL(href);
  if (!url.hash.startsWith("#/")) return null;

  const inner = new URL(url.hash.slice(1), url.origin);
  const params = new URLSearchParams(url.search);
  inner.searchParams.forEach((value, key) => params.set(key, value));
  const query = params.toString();
  return inner.pathname + (query ? `?${query}` : "") + inner.hash;
}
