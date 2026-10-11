import type { ReactElement } from "react";
import { BrowserRouter, Link, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import Landing from "./routes/Landing";
import HashLab from "./routes/HashLab";
import CommitmentLab from "./routes/CommitmentLab";
import MerkleLab from "./routes/MerkleLab";
import SignatureLab from "./routes/SignatureLab";
import SchnorrLab from "./routes/SchnorrLab";
import ZKColoringLab from "./routes/ZKColoringLab";
import Toolkit from "./routes/Toolkit";
import About from "./routes/About";
import { PAGES, type PagePath } from "./seo";

// typed against PAGES (src/seo.ts), so a page with no component, or a
// component with no title/description/sitemap entry, fails to compile
const ELEMENTS: Record<PagePath, ReactElement> = {
  "/": <Landing />,
  "/hash": <HashLab />,
  "/commitments": <CommitmentLab />,
  "/merkle": <MerkleLab />,
  "/signatures": <SignatureLab />,
  "/schnorr": <SchnorrLab />,
  "/zero-knowledge": <ZKColoringLab />,
  "/toolkit": <Toolkit />,
  "/about": <About />,
};

// unknown paths keep the header and footer; the server also answers them
// with 404.html (HTTP 404, noindex), and Layout marks them noindex here
function NotFound() {
  return (
    <div className="lab-header">
      <h1>Page not found</h1>
      <p>
        <Link to="/">Go to the homepage</Link>
      </p>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          {PAGES.map(({ path }) =>
            path === "/" ? (
              <Route key={path} index element={ELEMENTS[path]} />
            ) : (
              <Route key={path} path={path.slice(1)} element={ELEMENTS[path]} />
            ),
          )}
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
