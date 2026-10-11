/// <reference types="vitest/config" />
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { applyPageMetaToHtml, buildSitemap, NOT_FOUND, PAGES } from "./src/seo";

/** After the build, write one HTML file per public page (dist/merkle.html,
 * ...) with that page's title, description, and canonical already in the
 * head, plus a noindex 404.html and sitemap.xml, all from src/seo.ts. The
 * body is the same app shell everywhere; the router takes over from there.
 * vercel.json's cleanUrls serves dist/merkle.html at /merkle. */
function pageHtml(): Plugin {
  let outDir = "dist";
  return {
    name: "page-html",
    apply: "build",
    configResolved(config) {
      outDir = config.build.outDir;
    },
    writeBundle() {
      const template = readFileSync(join(outDir, "index.html"), "utf8");
      for (const page of PAGES) {
        const file = page.path === "/" ? "index.html" : `${page.path.slice(1)}.html`;
        writeFileSync(join(outDir, file), applyPageMetaToHtml(template, page));
      }
      writeFileSync(
        join(outDir, "404.html"),
        applyPageMetaToHtml(template, NOT_FOUND, { noindex: true }),
      );
      writeFileSync(join(outDir, "sitemap.xml"), buildSitemap());
    },
  };
}

// clean URLs (BrowserRouter) need absolute asset paths, so the site is
// served from the domain root
export default defineConfig({
  plugins: [react(), pageHtml()],
  base: "/",
  // honor an externally assigned port (e.g. tooling); default 5173
  server: { port: Number(process.env.PORT) || 5173 },
  test: {
    environment: "node",
    include: ["src/tests/**/*.test.ts"],
  },
});
