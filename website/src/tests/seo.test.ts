import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { legacyHashTarget } from "../legacyHash";
import {
  applyPageMetaToHtml,
  buildSitemap,
  canonicalUrl,
  findPage,
  NOT_FOUND,
  PAGES,
  SITE_URL,
} from "../seo";

const template = readFileSync(new URL("../../index.html", import.meta.url), "utf8");

describe("page metadata", () => {
  it("gives every page a unique path, title, and description", () => {
    for (const key of ["path", "title", "description"] as const) {
      const values = PAGES.map((p) => p[key]);
      expect(new Set(values).size).toBe(values.length);
    }
  });

  it("keeps descriptions short enough that Google shows them whole", () => {
    for (const p of PAGES) {
      expect(p.description.length, p.path).toBeLessThanOrEqual(160);
      expect(p.description.length, p.path).toBeGreaterThan(70);
    }
  });

  it("builds clean, absolute canonical URLs", () => {
    expect(canonicalUrl("/")).toBe(`${SITE_URL}/`);
    expect(canonicalUrl("/merkle")).toBe(`${SITE_URL}/merkle`);
    for (const p of PAGES) expect(canonicalUrl(p.path)).not.toContain("#");
  });

  it("finds pages with or without a trailing slash", () => {
    expect(findPage("/merkle")?.path).toBe("/merkle");
    expect(findPage("/merkle/")?.path).toBe("/merkle");
    expect(findPage("/")?.path).toBe("/");
    expect(findPage("/nope")).toBeUndefined();
  });
});

describe("per-page HTML", () => {
  it("rewrites title, description, canonical, and Open Graph tags", () => {
    const merkle = PAGES.find((p) => p.path === "/merkle")!;
    const html = applyPageMetaToHtml(template, merkle);
    expect(html).toContain(`<title>${merkle.title}</title>`);
    expect(html).toContain(`content="${merkle.description}"`);
    expect(html).toContain(`<link rel="canonical" href="${SITE_URL}/merkle" />`);
    expect(html).toContain(`<meta property="og:url" content="${SITE_URL}/merkle" />`);
    expect(html).not.toContain("noindex");
  });

  it("marks the 404 page noindex and drops its canonical", () => {
    const html = applyPageMetaToHtml(template, NOT_FOUND, { noindex: true });
    expect(html).toContain('<meta name="robots" content="noindex" />');
    expect(html).not.toContain('rel="canonical"');
  });

  it("fails loudly if the template loses a tag", () => {
    const broken = template.replace(/<link rel="canonical"[^>]*>/, "");
    expect(() => applyPageMetaToHtml(broken, PAGES[0])).toThrow();
  });
});

describe("sitemap", () => {
  it("lists every public page once, with clean absolute URLs", () => {
    const xml = buildSitemap();
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    expect(locs).toEqual(PAGES.map((p) => canonicalUrl(p.path)));
    for (const loc of locs) {
      expect(loc.startsWith("https://")).toBe(true);
      expect(loc).not.toContain("#");
    }
  });
});

describe("legacy hash URLs", () => {
  const at = (path: string) => legacyHashTarget(`https://example.com${path}`);

  it("moves /#/page to /page", () => {
    expect(at("/#/merkle")).toBe("/merkle");
    expect(at("/#/zero-knowledge")).toBe("/zero-knowledge");
    expect(at("/#/")).toBe("/");
  });

  it("keeps query strings from either side of the hash", () => {
    expect(at("/#/?classic=1")).toBe("/?classic=1");
    expect(at("/?classic=1#/")).toBe("/?classic=1");
    expect(at("/?a=1#/hash?b=2")).toBe("/hash?a=1&b=2");
  });

  it("leaves ordinary anchors and clean URLs alone", () => {
    expect(at("/#modules")).toBeNull();
    expect(at("/merkle")).toBeNull();
    expect(at("/")).toBeNull();
  });

  it("never produces a URL that would be rewritten again", () => {
    for (const path of ["/#/merkle", "/#/?classic=1", "/#/", "/?x=1#/about"]) {
      expect(at(at(path)!)).toBeNull();
    }
  });
});
