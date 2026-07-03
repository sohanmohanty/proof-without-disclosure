import { useState } from "react";
import CodeBlock from "../components/CodeBlock";
import Dropzone from "../components/Dropzone";
import Guarantees from "../components/Guarantees";
import HexDigest from "../components/HexDigest";
import MathAside from "../components/MathAside";
import { LabPage, Section } from "../components/LabPage";
import { commit, verifyReveal, type Commitment } from "../crypto/commitments";
import { commitmentDoc, downloadJson, revealDoc } from "../crypto/docs";

type Phase = "commit" | "committed" | "revealed";

export default function CommitmentLab() {
  const [secret, setSecret] = useState("The Sharks win game 5");
  const [committed, setCommitted] = useState<Commitment | null>(null);
  const [phase, setPhase] = useState<Phase>("commit");
  const [revealResult, setRevealResult] = useState<boolean | null>(null);
  const [cheatSecret, setCheatSecret] = useState("The Hawks win game 5");
  const [cheatResult, setCheatResult] = useState<boolean | null>(null);

  async function doCommit() {
    setCommitted(await commit(secret));
    setPhase("committed");
    setRevealResult(null);
    setCheatResult(null);
  }

  async function doReveal() {
    if (!committed) return;
    setRevealResult(await verifyReveal(committed.commitment, committed.secret, committed.salt));
    setPhase("revealed");
  }

  async function doCheat() {
    if (!committed) return;
    setCheatResult(await verifyReveal(committed.commitment, cheatSecret, committed.salt));
  }

  return (
    <LabPage
      kicker="Module 02"
      title="Commitments"
      question="How can you lock in a secret without revealing it yet?"
      intro={
        <p>
          Predict tonight's game — but publish the prediction only after it
          ends, and everyone should still believe you made it beforehand. A
          commitment is a cryptographic envelope: sealed now, opened later,
          and impossible to swap in between.
        </p>
      }
    >
      <Section title="Step 1 — Seal the envelope">
        <div className="split">
          <div>
            <label htmlFor="secret">Your secret prediction</label>
            <input
              id="secret"
              type="text"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              disabled={phase !== "commit"}
            />
            <div className="controls">
              <button className="primary" onClick={() => void doCommit()} disabled={phase !== "commit"}>
                Commit
              </button>
              {phase !== "commit" && (
                <button
                  className="ghost"
                  onClick={() => {
                    setPhase("commit");
                    setCommitted(null);
                    setRevealResult(null);
                    setCheatResult(null);
                  }}
                >
                  Start over
                </button>
              )}
            </div>
            <p className="footnote">
              commitment = SHA-256(salt : secret). The random salt stops anyone
              from just hashing likely predictions and comparing.
            </p>
          </div>
          <div>
            {committed ? (
              <>
                <HexDigest
                  label="commitment — post this publicly, it reveals nothing"
                  value={committed.commitment}
                />
                <HexDigest
                  label="salt — keep this private until the reveal"
                  value={committed.salt}
                />
                <div className="controls">
                  <button
                    className="ghost"
                    onClick={() => downloadJson(commitmentDoc(committed.commitment), "commitment.json")}
                  >
                    ⬇ commitment.json (public)
                  </button>
                  <button
                    className="ghost"
                    onClick={() => downloadJson(revealDoc(committed.secret, committed.salt), "reveal.json")}
                  >
                    ⬇ reveal.json (private)
                  </button>
                </div>
              </>
            ) : (
              <p className="footnote">
                Commit to see the sealed envelope: a digest anyone can copy,
                which whispers nothing about what is inside.
              </p>
            )}
          </div>
        </div>
      </Section>

      <Section title="Step 2 — The game ends. Open the envelope.">
        <p>
          Revealing means publishing the secret <em>and</em> the salt. Anyone
          can recompute SHA-256(salt : secret) and compare it with the
          commitment you posted before the game.
        </p>
        <div className="controls">
          <button className="primary" onClick={() => void doReveal()} disabled={phase !== "committed"}>
            Reveal honestly
          </button>
        </div>
        {revealResult !== null && (
          <div className={`banner ${revealResult ? "valid" : "invalid"}`}>
            <strong>{revealResult ? "✓ Commitment verified" : "✗ Mismatch"}</strong>
            <ul>
              <li>
                Recomputed hash {revealResult ? "matches" : "does not match"} the
                published commitment — the prediction{" "}
                {revealResult ? "was locked in before the game." : "was tampered with."}
              </li>
            </ul>
          </div>
        )}
      </Section>

      <Section title="Try to cheat: swap the prediction">
        <p>
          You committed, the game went the other way, and now you would like to
          "reveal" a different prediction with the same salt. Binding says this
          should fail — succeeding would mean finding a second input with the
          same SHA-256 output.
        </p>
        <div className="split">
          <div>
            <label htmlFor="cheat">Revised "prediction"</label>
            <input
              id="cheat"
              type="text"
              value={cheatSecret}
              onChange={(e) => setCheatSecret(e.target.value)}
            />
            <div className="controls">
              <button className="danger" onClick={() => void doCheat()} disabled={!committed}>
                Attempt dishonest reveal
              </button>
            </div>
          </div>
          <div>
            {cheatResult !== null && (
              <div className={`banner ${cheatResult ? "valid" : "invalid"}`}>
                <strong>
                  {cheatResult
                    ? "✓ (You typed the original secret back in!)"
                    : "✗ Caught — reveal rejected"}
                </strong>
                <ul>
                  <li>
                    {cheatResult
                      ? "Only the exact committed secret verifies."
                      : "The recomputed hash differs from the commitment. To cheat you would need a SHA-256 collision: expected work ~2¹²⁸ hashes."}
                  </li>
                </ul>
              </div>
            )}
          </div>
        </div>
      </Section>

      <Section title="Verify files from the CLI">
        <p>
          The <code>prooflab</code> toolkit writes the same format:{" "}
          <code>prooflab commit "my prediction"</code> produces{" "}
          <code>commitment.json</code> and <code>reveal.json</code>. Drop both
          here and the browser checks them — two implementations, one spec.
        </p>
        <Dropzone hint="Drop commitment.json together with reveal.json" />
      </Section>

      <Section title="Properties and fine print">
        <Guarantees
          does={[
            "Hiding: the commitment reveals nothing about the secret (thanks to the salt)",
            "Binding: you cannot open it to a different secret",
            "Anyone can verify the reveal with one hash",
          ]}
          doesnt={[
            "Doesn't prove WHEN you committed — pair it with a timestamped public post",
            "Doesn't force you to ever reveal",
            "Both properties are computational: they lean on SHA-256's strength",
          ]}
          world={[
            "Sealed-bid auctions: bid commitments open together",
            "Coin flips over the phone: commit, then call it",
            "Responsible disclosure: prove you knew of a bug early",
            "Module 05 commits to every node's color each round",
          ]}
        />
        <CodeBlock
          label="protocol"
          code={`
# commit phase                          # reveal phase
salt = random_bytes(16)                 publish(secret, salt)
c = SHA256(hex(salt) + ":" + secret)    # verifier:
publish(c)                              check SHA256(hex(salt)+":"+secret) == c`}
        />
        <MathAside>
          <p>
            Hash commitments are <em>computationally</em> hiding and binding:
            both properties reduce to properties of SHA-256 (preimage and
            collision resistance). Pedersen commitments (
            <code>c = g^m · h^r</code> in a prime-order group) flip the
            trade-off: <em>perfectly</em> hiding — even infinite compute learns
            nothing — but only computationally binding. Perfect hiding and
            perfect binding together are impossible: a commitment that is
            information-theoretically both would determine the secret uniquely
            while carrying no information about it.
          </p>
        </MathAside>
      </Section>
    </LabPage>
  );
}
