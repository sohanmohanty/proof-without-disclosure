/** Search metadata for every public page: the single list that drives the
 * router (App.tsx), the per-page HTML written at build time
 * (vite.config.ts), the sitemap, and the head tags updated on client-side
 * navigation. Adding a page means adding it here; App.tsx will not compile
 * until the new path also has a component.
 *
 * Pure data and string helpers only: vite.config.ts imports this file in
 * Node, so nothing here may touch the DOM at import time. */

export const SITE_URL = "https://proofwithoutdisclosure.com";
export const SITE_NAME = "Proof Without Disclosure";

export interface PageMeta {
  path: string;
  title: string;
  description: string;
}

export const PAGES = [
  {
    path: "/",
    title: "Proof Without Disclosure | Interactive Cryptography Lab",
    description:
      "Learn how cryptography proves things without revealing secrets. Interactive labs for hashes, commitments, Merkle trees, signatures, and zero-knowledge proofs.",
  },
  {
    path: "/hash",
    title: "Hash Functions | Proof Without Disclosure",
    description:
      "See how SHA-256 gives data a fingerprint. Change one character and watch half the bits flip, then hunt for collisions and see the birthday paradox at work.",
  },
  {
    path: "/commitments",
    title: "Commitments | Proof Without Disclosure",
    description:
      "Lock in a secret now and reveal it later. Seal a prediction with a salted SHA-256 commitment, then try to swap it and watch the check fail.",
  },
  {
    path: "/merkle",
    title: "Merkle Trees | Proof Without Disclosure",
    description:
      "Prove one item belongs to a set without showing the set. Build a Merkle tree, follow a membership proof, and see the RFC 6962 design that blocks forgeries.",
  },
  {
    path: "/signatures",
    title: "Digital Signatures | Proof Without Disclosure",
    description:
      "Prove who sent a message and that nobody changed it. Sign with real ECDSA P-256 in your browser, then try to break the signature and watch it fail.",
  },
  {
    path: "/zero-knowledge",
    title: "Zero-Knowledge Proofs | Proof Without Disclosure",
    description:
      "Prove you know a graph 3-coloring without revealing it. Challenge an honest prover round by round, then catch a cheater as the soundness bound tightens.",
  },
  {
    path: "/schnorr",
    title: "The Schnorr Protocol | Proof Without Disclosure",
    description:
      "Zero-knowledge from real algebra. Brute-force a toy key, fail against a 2048-bit group, then apply Fiat–Shamir to turn the proof into a signature.",
  },
  {
    path: "/toolkit",
    title: "prooflab Command-Line Toolkit | Proof Without Disclosure",
    description:
      "Run the math yourself with prooflab, a Python CLI that generates and verifies hashes, commitments, Merkle proofs, signatures, and Schnorr proofs locally.",
  },
  {
    path: "/about",
    title: "About | Proof Without Disclosure",
    description:
      "What Proof Without Disclosure is, how its website and CLI stay byte-compatible through one written spec, the standards behind it, and its honest limitations.",
  },
] as const satisfies readonly PageMeta[];

export type PagePath = (typeof PAGES)[number]["path"];

/** Served with HTTP 404 for unknown paths; never indexed. */
export const NOT_FOUND: PageMeta = {
  path: "/404",
  title: "Page not found | Proof Without Disclosure",
  description: "This page does not exist on Proof Without Disclosure.",
};

export function canonicalUrl(path: string): string {
  return path === "/" ? `${SITE_URL}/` : `${SITE_URL}${path}`;
}

export function findPage(pathname: string): PageMeta | undefined {
  const clean =
    pathname.length > 1 && pathname.endsWith("/")
      ? pathname.slice(0, -1)
      : pathname;
  return PAGES.find((p) => p.path === clean);
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Rewrite the head of the built index.html for one page: title,
 * description, canonical, Open Graph, and (for the 404 page) noindex.
 * Throws if a tag it expects is missing, so a template edit can't silently
 * ship pages that all claim to be the homepage. */
export function applyPageMetaToHtml(
  html: string,
  page: PageMeta,
  options: { noindex?: boolean } = {},
): string {
  const url = canonicalUrl(page.path);
  const title = escapeAttr(page.title);
  const description = escapeAttr(page.description);
  const swaps: [RegExp, string][] = [
    [/<title>[^<]*<\/title>/, `<title>${title}</title>`],
    [
      /(<meta\s+name="description"\s+content=")[^"]*(")/,
      `$1${description}$2`,
    ],
    [/(<link rel="canonical" href=")[^"]*(")/, `$1${url}$2`],
    [/(<meta property="og:title" content=")[^"]*(")/, `$1${title}$2`],
    [
      /(<meta\s+property="og:description"\s+content=")[^"]*(")/,
      `$1${description}$2`,
    ],
    [/(<meta property="og:url" content=")[^"]*(")/, `$1${url}$2`],
  ];
  let out = html;
  for (const [pattern, replacement] of swaps) {
    if (!pattern.test(out)) {
      throw new Error(`index.html is missing a tag matching ${pattern}`);
    }
    out = out.replace(pattern, replacement);
  }
  if (options.noindex) {
    out = out
      .replace(/\s*<link rel="canonical"[^>]*>/, "")
      .replace(
        /<title>/,
        `<meta name="robots" content="noindex" />\n    <title>`,
      );
  }
  return out;
}

export function buildSitemap(): string {
  const urls = PAGES.map(
    (p) => `  <url>\n    <loc>${canonicalUrl(p.path)}</loc>\n  </url>`,
  ).join("\n");
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    `${urls}\n</urlset>\n`
  );
}

/** Keep the live document's head in step with client-side navigation, so
 * the rendered page Google sees matches the pre-built HTML for that URL. */
export function applyPageMetaToDocument(pathname: string): void {
  const page = findPage(pathname);
  const meta = page ?? NOT_FOUND;
  document.title = meta.title;
  setAttr('meta[name="description"]', "content", meta.description);
  setAttr('meta[property="og:title"]', "content", meta.title);
  setAttr('meta[property="og:description"]', "content", meta.description);

  let canonical = document.querySelector<HTMLLinkElement>(
    'link[rel="canonical"]',
  );
  let robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
  if (page) {
    const url = canonicalUrl(page.path);
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
    }
    canonical.href = url;
    setAttr('meta[property="og:url"]', "content", url);
    robots?.remove();
  } else {
    canonical?.remove();
    if (!robots) {
      robots = document.createElement("meta");
      robots.name = "robots";
      document.head.appendChild(robots);
    }
    robots.content = "noindex";
  }
}

function setAttr(selector: string, attr: string, value: string): void {
  document.querySelector(selector)?.setAttribute(attr, value);
}
