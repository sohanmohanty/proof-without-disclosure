/** The loading screen: a real digest resolves out of hex noise, gets
 * verified, and the overlay lifts. It is diegetic — the string being
 * "computed" really is SHA-256 of "proof-without-disclosure", and the wait
 * really is the 3D chunk warming up behind it. Plays once per session;
 * any key, click, or scroll skips it. */

import { useEffect, useRef, useState } from "react";
import { sha256Hex } from "../crypto/hash";

const SOURCE = "proof-without-disclosure";
const SESSION_KEY = "pwd-intro-done";
const HEX = "0123456789abcdef";
const SCRAMBLE_SECONDS = 1.15;
const VERIFIED_SECONDS = 0.55;
const FADE_MS = 500;

/** In-memory fallback so storage-blocked browsers still only see the intro
 * once per page load (not on every return to the landing route). */
let playedThisLoad = false;

export function introAlreadyPlayed(): boolean {
  if (playedThisLoad) return true;
  try {
    return sessionStorage.getItem(SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

function markPlayed(): void {
  playedThisLoad = true;
  try {
    sessionStorage.setItem(SESSION_KEY, "1");
  } catch {
    /* private mode — the in-memory flag still covers this page load */
  }
}

function randomHex(length: number): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += HEX[(Math.random() * 16) | 0];
  }
  return out;
}

type Stage = "scramble" | "verified" | "fade";

export default function IntroOverlay({ onDone }: { onDone: () => void }) {
  const [display, setDisplay] = useState(() => randomHex(64));
  const [stage, setStage] = useState<Stage>("scramble");
  // the animation lifecycle must not restart when the parent re-renders
  // (it does so on every scroll past the first chapter) — keep the latest
  // callback in a ref and run the effect exactly once
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    let digest: string | null = null;
    let raf = 0;
    let doneTimer: number | undefined;
    let finished = false;
    const startedAt = performance.now();

    void sha256Hex(SOURCE).then((d) => {
      digest = d;
    });

    const beginFade = () => {
      if (finished) return;
      finished = true;
      markPlayed();
      setStage("fade");
      doneTimer = window.setTimeout(() => onDoneRef.current(), FADE_MS);
    };

    const tick = () => {
      const t = (performance.now() - startedAt) / 1000;
      if (t < SCRAMBLE_SECONDS || !digest) {
        const progress = digest ? Math.min(1, t / SCRAMBLE_SECONDS) : 0;
        const resolved = Math.floor((1 - Math.pow(1 - progress, 3)) * 64);
        setDisplay(
          (digest ?? "").slice(0, resolved) + randomHex(64 - resolved),
        );
        raf = requestAnimationFrame(tick);
        return;
      }
      setDisplay(digest);
      setStage("verified");
      doneTimer = window.setTimeout(beginFade, VERIFIED_SECONDS * 1000);
    };
    raf = requestAnimationFrame(tick);

    const skip = () => beginFade();
    window.addEventListener("keydown", skip);
    window.addEventListener("pointerdown", skip);
    window.addEventListener("wheel", skip, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(doneTimer);
      window.removeEventListener("keydown", skip);
      window.removeEventListener("pointerdown", skip);
      window.removeEventListener("wheel", skip);
    };
    // run exactly once per mount — restarting on prop identity changes
    // would resurrect a skipped overlay (the parent re-renders on scroll)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className={`intro-overlay${stage === "fade" ? " done" : ""}`}
      aria-hidden="true"
    >
      <div className="intro-inner">
        <p className="intro-title">Proof Without Disclosure</p>
        <p className="intro-hex">{display}</p>
        <p className={`intro-status${stage !== "scramble" ? " ok" : ""}`}>
          {stage === "scramble"
            ? `computing sha256("${SOURCE}") …`
            : "✓ digest verified — entering the lab"}
        </p>
      </div>
    </div>
  );
}
