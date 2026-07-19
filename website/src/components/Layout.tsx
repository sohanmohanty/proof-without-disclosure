import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { REPO_URL } from "../site";

const LINKS = [
  ["/hash", "Hash"],
  ["/commitments", "Commit"],
  ["/merkle", "Merkle"],
  ["/signatures", "Sign"],
  ["/zero-knowledge", "Zero-Knowledge"],
  ["/schnorr", "Schnorr"],
  ["/toolkit", "Toolkit"],
  ["/about", "About"],
] as const;

export default function Layout() {
  const { pathname } = useLocation();
  const [dark, setDark] = useState(
    () => document.documentElement.dataset.theme === "dark",
  );

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "";
    localStorage.setItem("pwd-theme", dark ? "dark" : "light");
  }, [dark]);

  // every route must open at its top: the 3D journey page is ~13,000px tall
  // and the browser keeps scroll across route swaps, so without this a
  // caption CTA clicked mid-journey opens the lab at its footer. "instant"
  // bypasses the global scroll-behavior: smooth. Skipped on first render so
  // the browser's own scroll restoration still works on reload.
  const firstRender = useRef(true);
  useLayoutEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname]);

  return (
    <>
      <header className="site-header">
        <div className="site-header-inner">
          <NavLink to="/" className="brand">
            Proof <span>Without</span> Disclosure
          </NavLink>
          <nav className="site-nav">
            {LINKS.map(([to, label]) => (
              <NavLink key={to} to={to}>
                {label}
              </NavLink>
            ))}
          </nav>
          <a
            className="gh-link"
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Source code on GitHub"
            title="Source code on GitHub"
          >
            <svg
              viewBox="0 0 16 16"
              width="18"
              height="18"
              aria-hidden="true"
              fill="currentColor"
            >
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
            </svg>
          </a>
          <button
            className="theme-toggle"
            onClick={() => setDark((d) => !d)}
            aria-label="Toggle color theme"
            title="Toggle color theme"
          >
            {dark ? "☀" : "☾"}
          </button>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
      <footer className="site-footer">
        <div className="site-footer-inner">
          <p>
            Everything on this site runs in your browser: no server, no
            uploads, no analytics. Companion CLI: <code>prooflab</code>.
            Implementations, format spec, and tests are open on{" "}
            <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
              GitHub
            </a>
            .
          </p>
          <p>Copyright (c) 2026 Sohan Mohanty.</p>
        </div>
      </footer>
    </>
  );
}
