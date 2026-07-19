/** Suspense fallback shown while the 3D chunk downloads. No three.js
 * imports; this ships in the main bundle. Mirrors the intro overlay's
 * layout so the handoff into the real experience is seamless. */

export default function HeroFallback() {
  return (
    <div className="journey-fallback">
      <p className="visually-hidden" role="status">
        Loading the interactive lab…
      </p>
      <div className="intro-inner" aria-hidden="true">
        <p className="intro-title">Proof Without Disclosure</p>
        <p className="intro-hex">{"·".repeat(64)}</p>
        <p className="intro-status">fetching the interactive lab…</p>
      </div>
    </div>
  );
}
