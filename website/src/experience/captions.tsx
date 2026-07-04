/** DOM-side content of the journey: the hero header (title + live hash
 * input), one caption card per chapter, and the outro. Every number shown
 * here is real — computed on mount by the same crypto modules the labs
 * use. The 3D scenes illustrate; these captions carry the actual data.
 */

import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import { commit } from "../crypto/commitments";
import { PETERSEN, cheatSurvivalBound, roundsForConfidence } from "../crypto/graphColoring";
import { sha256Hex } from "../crypto/hash";
import { hammingDistanceHex, utf8 } from "../crypto/hex";
import { buildTree, generateProof, rootOf } from "../crypto/merkle";
import { fiatShamirChallenge, keygen, prove, TOY_GROUP } from "../crypto/schnorr";
import { exportPublicKeyHex, generateKeyPair, sign } from "../crypto/signatures";
import { REPO_URL } from "../site";
import { expandDigestBits } from "./field";
import { heroGrid, journey } from "./journeyState";
import { scrollToModules } from "./scroll";
import type { ChapterId } from "./timeline";

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

function useAsync<T>(compute: () => Promise<T>): T | null {
  const [value, setValue] = useState<T | null>(null);
  useEffect(() => {
    let alive = true;
    void compute().then((v) => {
      if (alive) setValue(v);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once
  }, []);
  return value;
}

const short = (hex: string) => `${hex.slice(0, 10)}…${hex.slice(-6)}`;

/* ------------------------------------------------------------------ */
/* hero                                                                */
/* ------------------------------------------------------------------ */

const PHRASES = [
  "proof without disclosure",
  "trust, but verify",
  "nothing up my sleeve",
  "conviction without a confession",
  "what can you prove?",
];

export function HeroHeader() {
  const [typed, setTyped] = useState("");
  const [source, setSource] = useState(PHRASES[0]);
  const [digest, setDigest] = useState("");
  // while the field is focused, the readability scrim fades so the live
  // fingerprint field behind the input is revealed (see .j-hero.revealed)
  const [revealed, setRevealed] = useState(false);
  const typedRef = useRef("");
  const phraseIdx = useRef(0);
  const requestSeq = useRef(0);
  const debounceTimer = useRef<number>();

  async function show(text: string) {
    const seq = ++requestSeq.current;
    const d = await sha256Hex(text);
    const { cols, rows } = heroGrid(journey.quality);
    const bits = await expandDigestBits(d, cols * rows);
    if (seq !== requestSeq.current) return; // a newer request won
    journey.hero.digestHex = d;
    journey.hero.bits = bits;
    journey.hero.source = text;
    journey.hero.rippleAt = performance.now();
    setDigest(d);
  }

  useEffect(() => {
    void show(PHRASES[0]);
    const timer = window.setInterval(() => {
      if (typedRef.current) return; // the visitor's text wins
      phraseIdx.current = (phraseIdx.current + 1) % PHRASES.length;
      const next = PHRASES[phraseIdx.current];
      setSource(next);
      void show(next);
    }, 7000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once
  }, []);

  const onChange = (value: string) => {
    setTyped(value);
    typedRef.current = value;
    const text = value || PHRASES[phraseIdx.current];
    setSource(text);
    window.clearTimeout(debounceTimer.current);
    debounceTimer.current = window.setTimeout(() => void show(text), 90);
  };

  return (
    <header className={`j-hero${revealed ? " revealed" : ""}`}>
      <h1>Proof Without Disclosure</h1>
      <p className="tagline">
        An interactive cryptography lab about trust, privacy, and
        verification.
      </p>
      <p className="core-question">
        What can you prove without revealing more than necessary?
      </p>
      <div className="j-hash-input">
        <label className="visually-hidden" htmlFor="hero-hash-input">
          Type anything — the field behind is its SHA-256 fingerprint
        </label>
        <input
          id="hero-hash-input"
          type="text"
          maxLength={120}
          placeholder="type anything — the field behind you is its fingerprint"
          value={typed}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setRevealed(true)}
          onBlur={() => setRevealed(false)}
          autoComplete="off"
          spellCheck={false}
        />
      </div>
      {/* no aria-live: announcing a 64-char hash on every keystroke (and
          every 7s while idle) would be hostile to screen-reader users */}
      <p className="j-digest">
        <span className="j-digest-src">sha256("{source}") =</span>
        <code>{digest || "…"}</code>
      </p>
      <div className="privacy-chip">
        ● Everything runs in your browser — nothing is uploaded, ever.
      </div>
      <p className="j-cue" aria-hidden="true">
        scroll — six ways to prove without revealing ↓
      </p>
    </header>
  );
}

/* ------------------------------------------------------------------ */
/* per-chapter readouts (real crypto, computed on mount)               */
/* ------------------------------------------------------------------ */

function HashReadout() {
  const pair = useAsync(async () => {
    const a = await sha256Hex("hello");
    const b = await sha256Hex("hellp");
    return { a, b, flipped: hammingDistanceHex(a, b) };
  });
  if (!pair) return null;
  return (
    <dl className="j-readout">
      <div>
        <dt>sha256("hello")</dt>
        <dd>
          <code>{short(pair.a)}</code>
        </dd>
      </div>
      <div>
        <dt>sha256("hellp")</dt>
        <dd>
          <code>{short(pair.b)}</code>
        </dd>
      </div>
      <div>
        <dt>bits flipped</dt>
        <dd>
          <b>
            {pair.flipped} of {pair.a.length * 4}
          </b>
        </dd>
      </div>
    </dl>
  );
}

function CommitReadout() {
  const data = useAsync(() => commit("the winner will be team blue"));
  if (!data) return null;
  return (
    <dl className="j-readout">
      <div>
        <dt>secret</dt>
        <dd>"{data.secret}"</dd>
      </div>
      <div>
        <dt>published commitment</dt>
        <dd>
          <code>{short(data.commitment)}</code>
        </dd>
      </div>
      <div>
        <dt>reveals</dt>
        <dd>nothing — until you open it</dd>
      </div>
    </dl>
  );
}

const STUDENTS = ["student_1", "student_2", "student_3", "student_4", "student_5"];

function MerkleReadout() {
  const data = useAsync(async () => {
    const tree = await buildTree(STUDENTS);
    return { root: rootOf(tree), proofLen: generateProof(tree, 1).length };
  });
  if (!data) return null;
  return (
    <dl className="j-readout">
      <div>
        <dt>set</dt>
        <dd>{STUDENTS.length} students</dd>
      </div>
      <div>
        <dt>root</dt>
        <dd>
          <code>{short(data.root)}</code>
        </dd>
      </div>
      <div>
        <dt>proof for student_2</dt>
        <dd>
          <b>{data.proofLen} hashes</b> — the other names stay dark
        </dd>
      </div>
    </dl>
  );
}

function SignatureReadout() {
  const data = useAsync(async () => {
    const pair = await generateKeyPair();
    const message = "I built this lab.";
    const signature = await sign(pair.privateKey, utf8(message));
    const publicKey = await exportPublicKeyHex(pair.publicKey);
    return { message, signature, publicKey };
  });
  if (!data) return null;
  return (
    <dl className="j-readout">
      <div>
        <dt>message</dt>
        <dd>"{data.message}"</dd>
      </div>
      <div>
        <dt>public key</dt>
        <dd>
          <code>{short(data.publicKey)}</code>
        </dd>
      </div>
      <div>
        <dt>signature r‖s</dt>
        <dd>
          <code>{short(data.signature)}</code> — 64 bytes, fresh every visit
        </dd>
      </div>
    </dl>
  );
}

function ZKReadout() {
  const edges = PETERSEN.edges.length;
  const after100 = cheatSurvivalBound(edges, 100);
  const millionRounds = roundsForConfidence(edges, 1e-6);
  return (
    <dl className="j-readout">
      <div>
        <dt>cheater caught per round</dt>
        <dd>
          <b>1 in {edges}</b>
        </dd>
      </div>
      <div>
        <dt>survives 100 rounds</dt>
        <dd>
          <b>{(after100 * 100).toFixed(2)}%</b>
        </dd>
      </div>
      <div>
        <dt>&lt; one-in-a-million</dt>
        <dd>
          <b>{millionRounds} rounds</b>
        </dd>
      </div>
    </dl>
  );
}

function SchnorrReadout() {
  const data = useAsync(async () => {
    const key = keygen(TOY_GROUP, 7n);
    const proof = await prove(key, "hello", 5n);
    const c = await fiatShamirChallenge(TOY_GROUP, key.y, proof.R, "hello");
    return {
      y: key.y.toString(),
      R: proof.R.toString(),
      c: c.toString(),
      s: proof.s.toString(),
    };
  });
  if (!data) return null;
  return (
    <dl className="j-readout">
      <div>
        <dt>y = 4⁷ mod 23</dt>
        <dd>
          <b>{data.y}</b> (public; x = 7 stays hidden)
        </dd>
      </div>
      <div>
        <dt>R = 4⁵ mod 23</dt>
        <dd>
          <b>{data.R}</b>
        </dd>
      </div>
      <div>
        <dt title='SHA-256 of the domain-separated transcript ("prooflab-schnorr-v1|toy-23|…|hello"), reduced mod q — byte-exact rules in docs/format-spec.md'>
          c = H(transcript) mod 11
        </dt>
        <dd>
          <b>{data.c}</b>
        </dd>
      </div>
      <div>
        <dt>s = (5 + c·7) mod 11</dt>
        <dd>
          <b>{data.s}</b> — verifies: 4ˢ ≡ R·yᶜ
        </dd>
      </div>
    </dl>
  );
}

/* ------------------------------------------------------------------ */
/* caption cards                                                       */
/* ------------------------------------------------------------------ */

interface CaptionSpec {
  num: string;
  title: string;
  lab: string;
  labLabel: string;
  side: "j-left" | "j-right";
  body: ReactNode;
  readout?: () => ReactNode;
}

const CAPTIONS: Partial<Record<ChapterId, CaptionSpec>> = {
  hash: {
    num: "01",
    title: "Data gets a fingerprint",
    lab: "/hash",
    labLabel: "Open the Hash lab →",
    side: "j-right",
    body: (
      <>
        Any amount of data goes in; exactly 256 bits come out, and there is
        no way back. Change one letter and half the lattice flips — the
        avalanche effect. That asymmetry is the raw material every proof on
        this site is built from.
      </>
    ),
    readout: HashReadout,
  },
  commit: {
    num: "02",
    title: "Seal now, reveal later",
    lab: "/commitments",
    labLabel: "Open the Commitment lab →",
    side: "j-left",
    body: (
      <>
        Publish the hash of a secret today and you are locked in without
        having given anything away: the sealed sphere hides what's inside
        (<em>hiding</em>) and won't accept a substitute (<em>binding</em>).
        Open it whenever you like — everyone can check you never changed
        your mind.
      </>
    ),
    readout: CommitReadout,
  },
  merkle: {
    num: "03",
    title: "One root vouches for everything",
    lab: "/merkle",
    labLabel: "Open the Merkle lab →",
    side: "j-right",
    body: (
      <>
        Hash pairs of hashes upward and a whole dataset folds into one
        32-byte root. Proving one leaf belongs takes only the glowing path —
        log₂(n) hashes — while every other leaf stays dark. Certificate
        Transparency runs on exactly this tree.
      </>
    ),
    readout: MerkleReadout,
  },
  signature: {
    num: "04",
    title: "Identity, not just integrity",
    lab: "/signatures",
    labLabel: "Open the Signature lab →",
    side: "j-left",
    body: (
      <>
        An elliptic-curve keypair splits the power to <em>prove</em> from
        the power to <em>check</em>. Signing stamps a document with 64
        bytes that anyone can verify came from your key — and no one can
        forge, because the chord-and-tangent dance only runs one way.
      </>
    ),
    readout: SignatureReadout,
  },
  zk: {
    num: "05",
    title: "Convince without revealing",
    lab: "/zero-knowledge",
    labLabel: "Open the Zero-Knowledge lab →",
    side: "j-right",
    body: (
      <>
        Each round the prover reshuffles the three colors, seals every node,
        and the verifier opens one edge: two different colors, every time.
        One round proves almost nothing. Two hundred rounds are a wall. The
        colors themselves? Never revealed.
      </>
    ),
    readout: ZKReadout,
  },
  schnorr: {
    num: "06",
    title: "The capstone: prove you hold a key",
    lab: "/schnorr",
    labLabel: "Open the Schnorr lab →",
    side: "j-left",
    body: (
      <>
        Commit to a random point, take a challenge, answer with a single
        number: g<sup>s</sup> ≡ R·y<sup>c</sup> settles it without exposing
        x. Then replace the challenger with a hash function — Fiat–Shamir —
        and the whole dialogue collapses into a signature. The verifier was
        a hash all along.
      </>
    ),
    readout: SchnorrReadout,
  },
};

export function CaptionFor({ id }: { id: ChapterId }) {
  const spec = CAPTIONS[id];
  if (!spec) return null;
  const Readout = spec.readout;
  return (
    <div className={`j-caption ${spec.side}`}>
      <span className="j-num">{spec.num}</span>
      <h2>{spec.title}</h2>
      <p>{spec.body}</p>
      {Readout ? <Readout /> : null}
      <Link className="j-cta" to={spec.lab}>
        {spec.labLabel}
      </Link>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* outro                                                               */
/* ------------------------------------------------------------------ */

export function OutroContent() {
  return (
    <div className="j-outro">
      <h2>Now try to cheat.</h2>
      <p>
        Every lesson here ends the same way: watch a forged proof fail. Six
        interactive labs, a drag-and-drop verifier, and a Python CLI that
        speaks the same byte-level format.
      </p>
      <div className="btn-row">
        <button className="btn-primary" onClick={scrollToModules}>
          Explore the six modules ↓
        </button>
        <Link className="btn-ghost" to="/toolkit">
          Get the CLI toolkit →
        </Link>
      </div>
      <a
        className="j-source"
        href={REPO_URL}
        target="_blank"
        rel="noopener noreferrer"
      >
        or read the source on GitHub →
      </a>
    </div>
  );
}
