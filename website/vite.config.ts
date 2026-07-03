/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base "./" + HashRouter = the built site works from any static host or
// subdirectory (GitHub Pages, Vercel, Netlify, even file://) with no config.
export default defineConfig({
  plugins: [react()],
  base: "./",
  // honor an externally assigned port (e.g. tooling); default 5173
  server: { port: Number(process.env.PORT) || 5173 },
  test: {
    environment: "node",
    include: ["src/tests/**/*.test.ts"],
  },
});
