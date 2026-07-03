import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";

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
  const [dark, setDark] = useState(
    () => document.documentElement.dataset.theme === "dark",
  );

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "";
    localStorage.setItem("pwd-theme", dark ? "dark" : "light");
  }, [dark]);

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
            <strong>Educational project.</strong> Proof Without Disclosure
            demonstrates cryptographic concepts through interactive simulations
            and local tools. It is not audited, not production-grade, and must
            not be used to secure sensitive real-world systems.
          </p>
          <p>
            Everything on this site runs in your browser — no server, no
            uploads, no analytics. Companion CLI: <code>prooflab</code>.
          </p>
        </div>
      </footer>
    </>
  );
}
