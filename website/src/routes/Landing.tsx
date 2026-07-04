import { lazy, Suspense, useMemo } from "react";
import { useLocation } from "react-router-dom";
import HomeContent from "../components/HomeContent";
import { detectCapabilities, wantsClassic } from "../experience/capabilities";
import HeroFallback from "../experience/HeroFallback";
import Home from "./Home";

/** The 3D journey is one lazy chunk — visitors who get the classic page
 * never download a byte of three.js. */
const Journey = lazy(() => import("../experience"));

export default function Landing() {
  const location = useLocation();
  const caps = useMemo(detectCapabilities, []);

  // check both query forms: HashRouter only sees "#/?classic=1", but the
  // naturally typed "site/?classic=1" puts the query before the hash
  if (
    wantsClassic(location.search) ||
    wantsClassic(window.location.search) ||
    !caps.webgl ||
    caps.reducedMotion
  ) {
    return <Home />;
  }
  return (
    <>
      <Suspense fallback={<HeroFallback />}>
        <Journey />
      </Suspense>
      <HomeContent />
    </>
  );
}
