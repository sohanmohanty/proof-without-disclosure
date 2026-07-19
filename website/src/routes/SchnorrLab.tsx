import { useMemo, useState } from "react";
import CodeBlock from "../components/CodeBlock";
import Dropzone from "../components/Dropzone";
import Guarantees from "../components/Guarantees";
import MathAside from "../components/MathAside";
import { LabPage, Section } from "../components/LabPage";
import { nextTask } from "../crypto/async";
import { downloadJson, schnorrProofDoc } from "../crypto/docs";
import * as schnorr from "../crypto/schnorr";

type StepState =
  | { step: "idle" }
  | { step: "committed"; r: bigint; R: bigint }
  | { step: "challenged"; r: bigint; R: bigint; c: bigint }
  | { step: "checked"; r: bigint; R: bigint; c: bigint; s: bigint; ok: boolean };

function fmt(group: schnorr.Group, v: bigint): string {
  if (group.name === "toy-23") return v.toString();
  const hex = schnorr.toHex(group, v);
  return hex.slice(0, 12) + "…" + hex.slice(-8);
}

export default function SchnorrLab() {
  const [groupName, setGroupName] = useState<"toy-23" | "modp-2048">("toy-23");
  const group = schnorr.GROUPS[groupName];
  const toy = groupName === "toy-23";

  const [key, setKey] = useState<schnorr.KeyPair | null>(null);
  const [showPrivate, setShowPrivate] = useState(false);
  const [state, setState] = useState<StepState>({ step: "idle" });
  const [passes, setPasses] = useState(0);

  // cheat mode
  const [cheatStats, setCheatStats] = useState<{ wins: number; trials: number } | null>(null);
  const [cheatBusy, setCheatBusy] = useState(false);
  // crack mode
  const [crack, setCrack] = useState<string | null>(null);
  // fiat-shamir
  const [message, setMessage] = useState("I am the holder of this key");
  const [niProof, setNiProof] = useState<{ proof: schnorr.Proof; c: bigint } | null>(null);

  const subgroup = useMemo(() => {
    if (!toy) return [];
    const values: bigint[] = [];
    let acc = 1n;
    for (let i = 0n; i < group.q; i++) {
      values.push(acc);
      acc = (acc * group.g) % group.p;
    }
    return values;
  }, [toy, group]);

  function switchGroup(name: "toy-23" | "modp-2048") {
    setGroupName(name);
    setKey(null);
    setState({ step: "idle" });
    setPasses(0);
    setCheatStats(null);
    setCrack(null);
    setNiProof(null);
    setShowPrivate(false);
  }

  function doKeygen() {
    setKey(schnorr.keygen(group));
    setState({ step: "idle" });
    setPasses(0);
    setCheatStats(null);
    setCrack(null);
    setNiProof(null);
  }

  function stepCommit() {
    const { r, R } = schnorr.commitNonce(group);
    setState({ step: "committed", r, R });
  }

  function stepChallenge() {
    if (state.step !== "committed") return;
    setState({ ...state, step: "challenged", c: schnorr.randomChallenge(group) });
  }

  function stepRespond() {
    if (state.step !== "challenged" || !key) return;
    const s = schnorr.respond(group, key.x, state.r, state.c);
    const ok = schnorr.check(group, key.y, state.R, state.c, s);
    setState({ ...state, step: "checked", s, ok });
    if (ok) setPasses((p) => p + 1);
  }

  async function runCheat(trials: number) {
    if (!key) return;
    setCheatBusy(true);
    setCheatStats(null);
    await nextTask(); // let the busy label paint before the number-crunching
    let wins = 0;
    for (let i = 0; i < trials; i++) {
      const guessed = schnorr.randomChallenge(group);
      const { s, R } = schnorr.forgeCommitment(group, key.y, guessed);
      const actual = schnorr.randomChallenge(group);
      if (schnorr.check(group, key.y, R, actual, s)) wins++;
      // 2048-bit modPows are heavy; yield so the page stays responsive
      if (!toy && i % 4 === 3) await nextTask();
    }
    setCheatStats({ wins, trials });
    setCheatBusy(false);
  }

  function runCrack() {
    if (!key) return;
    const start = performance.now();
    const found = schnorr.bruteForceDlog(group, key.y, toy ? undefined : 150_000n);
    const ms = performance.now() - start;
    if (found !== null) {
      setCrack(
        `Cracked in ${ms.toFixed(1)} ms: x = ${found}. Eleven possible exponents ` +
        `is not a lock, it's a suggestion.`,
      );
    } else {
      const rate = 150_000 / (ms / 1000);
      // q ≈ 10^616 overflows Number, so work with log10:
      // log10(years) = log10(q) − log10(rate · seconds/year)
      const log10q = (group.q.toString().length - 1) + Math.log10(Number(group.q.toString().slice(0, 15)) / 1e14);
      const log10years = log10q - Math.log10(rate * 31_557_600);
      setCrack(
        `Tried 150,000 exponents in ${ms.toFixed(0)} ms (~${Math.round(rate).toLocaleString()}/s). ` +
        `At this rate, sweeping q ≈ 2^2046 would take ~10^${Math.round(log10years)} years; ` +
        `the universe is ~1.4×10^10 years old. This is what "computationally hard" means.`,
      );
    }
  }

  async function makeNiProof() {
    if (!key) return;
    const proof = await schnorr.prove(key, message);
    const c = await schnorr.fiatShamirChallenge(group, proof.y, proof.R, message);
    setNiProof({ proof, c });
  }

  return (
    <LabPage
      kicker="Module 06"
      title="The Schnorr Protocol"
      question="Can zero-knowledge be built from real algebra, and turned into a signature?"
      intro={
        <p>
          Module 05 played zero-knowledge as a game. This is the real thing:
          the prover holds a secret exponent <code>x</code> and proves knowledge
          of it: the exact protocol family behind Bitcoin's Taproot signatures.
          The arena is a multiplicative group: fix a prime <code>p</code> and
          generator <code>g</code>; the public key is{" "}
          <code>y = g<sup>x</sup> mod p</code>. Computing y from x is instant.
          Computing x from y is the <strong>discrete logarithm problem</strong>,
          and in a big enough group, nobody on earth can do it.
        </p>
      }
    >
      <Section title="Pick your arena">
        <div className="controls">
          <button
            className={toy ? "primary" : "ghost"}
            onClick={() => switchGroup("toy-23")}
            disabled={cheatBusy}
          >
            Toy group (p = 23)
          </button>
          <button
            className={!toy ? "primary" : "ghost"}
            onClick={() => switchGroup("modp-2048")}
            disabled={cheatBusy}
          >
            Real group (p = 2048 bits, RFC 3526)
          </button>
          <button className="ghost" onClick={doKeygen} disabled={cheatBusy}>
            {key ? "New key pair" : "Generate key pair"}
          </button>
        </div>
        {toy && (
          <>
            <p>
              Every number fits in your head: p = 23, generator g = 4, and the
              powers of 4 cycle through exactly q = 11 values:
            </p>
            <CodeBlock
              label="the whole subgroup: the clock this protocol runs on"
              code={
                "x:        " + subgroup.map((_, i) => String(i).padStart(3)).join("") +
                "\n4^x mod 23:" + subgroup.map((v) => String(v).padStart(3)).join("")
              }
            />
            <p className="footnote">
              Discrete log here = reading this table backwards. That is the
              entire attack, which is why real groups make the table
              2<sup>2046</sup> entries long.
            </p>
          </>
        )}
        {key && (
          <div className="split">
            <div>
              <div className="hex-label">public key y = g^x mod p (share this)</div>
              <div className="hex">{toy ? key.y.toString() : schnorr.toHex(group, key.y)}</div>
            </div>
            <div>
              <div className="hex-label">
                private key x:{" "}
                <button
                  className="ghost"
                  style={{ padding: "0 0.4rem", fontSize: "0.75rem" }}
                  onClick={() => setShowPrivate((s) => !s)}
                >
                  {showPrivate ? "hide" : "peek (you're the prover)"}
                </button>
              </div>
              <div className="hex">
                {showPrivate ? (toy ? key.x.toString() : schnorr.toHex(group, key.x)) : "•".repeat(24)}
              </div>
            </div>
          </div>
        )}
      </Section>

      <Section title="The three-move dance, step by step">
        <p>
          Prove you know x without revealing it. Each move is one button.
          Watch what each party actually sends.
        </p>
        <div className="controls">
          <button className="primary" onClick={stepCommit} disabled={!key || state.step === "committed" || state.step === "challenged"}>
            1. Prover commits: R = g^r
          </button>
          <button className="primary" onClick={stepChallenge} disabled={state.step !== "committed"}>
            2. Verifier challenges: random c
          </button>
          <button className="primary" onClick={stepRespond} disabled={state.step !== "challenged"}>
            3. Prover responds: s = r + c·x
          </button>
        </div>
        {state.step !== "idle" && key && (
          <CodeBlock
            label="transcript"
            code={[
              `prover  → verifier :  R = g^r mod p = ${fmt(group, state.R)}   (r stays secret)`,
              "c" in state ? `verifier → prover  :  c = ${fmt(group, state.c)}   (uniform random)` : null,
              "s" in state ? `prover  → verifier :  s = r + c·x mod q = ${fmt(group, state.s)}` : null,
              "s" in state
                ? `verifier checks    :  g^s == R · y^c  (mod p)   →   ${
                    fmt(group, schnorr.modPow(group.g, state.s, group.p))
                  } == ${
                    fmt(group, (state.R * schnorr.modPow(key.y, state.c, group.p)) % group.p)
                  }`
                : null,
            ].filter(Boolean).join("\n")}
          />
        )}
        {state.step === "checked" && (
          <div className={`banner ${state.ok ? "valid" : "invalid"}`}>
            <strong>{state.ok ? "✓ Verifier convinced" : "✗ Check failed"}</strong>
            <ul>
              <li>
                g^s = g^(r+c·x) = g^r · (g^x)^c = R · y^c; the algebra only
                closes if the prover used the real x. Yet the verifier saw only
                (R, c, s): the secret never crossed the wire.
              </li>
            </ul>
          </div>
        )}
        {passes > 0 && (
          <p className="footnote">Rounds passed: {passes}. Soundness error per round: 1/q {toy ? "= 1/11; run the cheat below to feel how loose that is" : "≈ 2^-2046; one round is enough"}.</p>
        )}
      </Section>

      <Section title="Try to cheat, then try to steal">
        <div className="split">
          <div>
            <h3>Prove without the key</h3>
            <p className="footnote">
              A cheater can't answer a challenge they didn't expect, but they
              can <em>guess</em> the challenge c*, pick s at random, and
              precompute R = g^s · y^(−c*). They win only when the verifier's
              real c equals their guess: probability exactly 1/q.
            </p>
            <div className="controls">
              <button
                className="danger"
                onClick={() => void runCheat(toy ? 550 : 50)}
                disabled={!key || cheatBusy}
              >
                {cheatBusy ? "Forging…" : `Forge ${toy ? 550 : 50} rounds without x`}
              </button>
            </div>
            {cheatStats && (
              <div className={`banner ${cheatStats.wins > 0 ? "info" : "valid"}`}>
                <strong>
                  {cheatStats.wins} of {cheatStats.trials} forgeries slipped through
                </strong>
                <ul>
                  <li>
                    {toy
                      ? `Expected ≈ ${Math.round(cheatStats.trials / 11)} (1/q = 1/11). A toy group leaks; run this in the real group.`
                      : "Expected ≈ 0: with q ≈ 2^2046, guessing the challenge is not a strategy, it's a prayer."}
                  </li>
                </ul>
              </div>
            )}
          </div>
          <div>
            <h3>Steal the key by brute force</h3>
            <p className="footnote">
              Everything needed to attack is public: y, g, p. Just try every
              exponent until g^x = y. How far does that get?
            </p>
            <div className="controls">
              <button className="danger" onClick={runCrack} disabled={!key}>
                Brute-force the discrete log
              </button>
            </div>
            {crack && (
              <div className={`banner ${toy ? "invalid" : "valid"}`}>
                <strong>{toy ? "✗ Key recovered" : "✓ Attack hopeless"}</strong>
                <ul><li>{crack}</li></ul>
              </div>
            )}
          </div>
        </div>
      </Section>

      <Section title="Remove the verifier: Fiat–Shamir">
        <p>
          The verifier's only job was supplying an unpredictable c. A hash
          function can do that: set{" "}
          <code>c = H(group ∥ y ∥ R ∥ message)</code>. The prover can no longer
          guess c first: c is determined by their own commitment R. The proof
          becomes a file anyone can check, no conversation needed.{" "}
          <strong>And because a message rides inside the hash, what you get is
          a signature</strong>. This construction, on an elliptic curve, is
          how Schnorr signatures secure Bitcoin Taproot today.
        </p>
        <div className="controls">
          <input
            type="text"
            style={{ maxWidth: "420px" }}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            aria-label="Message to bind into the proof"
          />
          <button className="primary" onClick={() => void makeNiProof()} disabled={!key}>
            Create non-interactive proof
          </button>
          {niProof && (
            <button
              className="ghost"
              onClick={() =>
                downloadJson(
                  schnorrProofDoc(
                    group.name,
                    schnorr.toHex(group, niProof.proof.y),
                    schnorr.toHex(group, niProof.proof.R),
                    schnorr.toHex(group, niProof.proof.s),
                    niProof.proof.message,
                  ),
                  "schnorr_proof.json",
                )
              }
            >
              ⬇ schnorr_proof.json
            </button>
          )}
        </div>
        {niProof && (
          <>
            <CodeBlock
              label="non-interactive proof = (R, s) + the hash-derived challenge"
              code={[
                `R = ${fmt(group, niProof.proof.R)}`,
                `c = H("${schnorr.DOMAIN}" | ${group.name} | y | R | "${niProof.proof.message}") mod q`,
                `  = ${fmt(group, niProof.c)}`,
                `s = r + c·x mod q = ${fmt(group, niProof.proof.s)}`,
              ].join("\n")}
            />
            <div className="banner valid">
              <strong>✓ You just built a digital signature.</strong>
              <ul>
                <li>
                  A Schnorr signature IS a zero-knowledge proof of knowledge of
                  the private key, made non-interactive by a hash and bound to a
                  message. Module 01 (hash) + module 05 (interactive proof) =
                  module 04 (signature). The lab was one machine all along.
                </li>
              </ul>
            </div>
          </>
        )}
        <p>
          Verify CLI proofs here (<code>prooflab schnorr keygen && prooflab
          schnorr prove --key schnorr_key.json --message "hi"</code>), or
          download this one and run <code>prooflab schnorr verify</code>.
        </p>
        <Dropzone hint="Drop a schnorr_proof.json (from the CLI or downloaded above)" />
      </Section>

      <Section title="Guarantees, and the fine print that matters">
        <Guarantees
          does={[
            "Proves knowledge of x with soundness error 1/q per round",
            "Zero-knowledge: transcripts are simulatable without x",
            "Fiat–Shamir removes interaction and binds a message",
            "Security reduces to one clean problem: discrete log",
          ]}
          doesnt={[
            "A reused or predictable nonce r leaks x instantly (ask Sony, PS3 2010)",
            "The toy group is breakable by anyone: group size IS the security",
            "This demo code is educational; real wallets use audited libraries",
          ]}
          world={[
            "Bitcoin Taproot signatures are Schnorr on secp256k1",
            "Ed25519 (SSH, Signal, TLS) descends from this design",
            "Anonymous-credential systems build on sigma protocols like this",
          ]}
        />
        <MathAside>
          <p>
            <strong>Soundness (extraction).</strong> Two accepting answers for
            one R give s₁ = r + c₁x and s₂ = r + c₂x, so x = (s₁−s₂)/(c₁−c₂)
            mod q; anyone who can answer two challenges must know x. This is
            also the nonce-reuse disaster: two signatures sharing r hand the
            world that same equation. <strong>Zero-knowledge (simulation).</strong>{" "}
            Pick c and s first, set R = g^s·y^(−c): a perfect transcript, forged
            without x. Order of moves is everything: live, R comes first; in
            Fiat–Shamir, c = H(...R...) restores that order cryptographically.{" "}
            <strong>Why g = 4?</strong> p = 2q+1 is a safe prime, and squaring
            any element lands in the subgroup of quadratic residues, which has
            prime order q, so ord(4) = q for every safe prime p &gt; 5. Prime
            order matters: it kills small-subgroup attacks and makes every
            non-identity element a generator.
          </p>
        </MathAside>
      </Section>
    </LabPage>
  );
}
