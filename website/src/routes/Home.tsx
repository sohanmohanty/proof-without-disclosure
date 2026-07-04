import { Link, useSearchParams } from "react-router-dom";
import HomeContent from "../components/HomeContent";

/** The classic landing page — also the fallback for visitors who can't run
 * (or don't want) the 3D journey: no WebGL, prefers-reduced-motion, or an
 * explicit ?classic=1. */
export default function Home() {
  const [params] = useSearchParams();
  return (
    <>
      <div className="hero">
        <h1>Proof Without Disclosure</h1>
        <p className="tagline">
          An interactive cryptography lab about trust, privacy, and
          verification.
        </p>
        <p className="core-question">
          What can you prove without revealing more than necessary?
        </p>
        <div className="privacy-chip">
          ● Everything runs in your browser — nothing is uploaded, ever.
        </div>
        {params.has("classic") && (
          <p className="back-to-3d">
            <Link to="/">✦ Take the 3D tour instead</Link>
          </p>
        )}
      </div>

      <HomeContent />
    </>
  );
}
