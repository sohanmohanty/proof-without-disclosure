import { useEffect, useRef, useState } from "react";
import CodeBlock from "../components/CodeBlock";
import Guarantees from "../components/Guarantees";
import HexDigest from "../components/HexDigest";
import MathAside from "../components/MathAside";
import { LabPage, Section } from "../components/LabPage";
import { findTruncatedCollision, sha256FileHex, sha256Hex } from "../crypto/hash";
import { hammingDistanceHex } from "../crypto/hex";

export default function HashLab() {
  const [input, setInput] = useState("hello");
  const [digest, setDigest] = useState("");
  const [previous, setPrevious] = useState<{ input: string; digest: string } | null>(null);
  // last committed (input, digest) pair, kept in a ref so the effect stays pure
  const last = useRef<{ input: string; digest: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void sha256Hex(input).then((d) => {
      if (cancelled) return;
      if (last.current && last.current.input !== input) {
        setPrevious(last.current);
      }
      last.current = { input, digest: d };
      setDigest(d);
    });
    return () => {
      cancelled = true;
    };
  }, [input]);

  const diffBits =
    previous && digest && previous.digest !== digest
      ? hammingDistanceHex(previous.digest, digest)
      : null;

  // file hashing
  const [fileDigest, setFileDigest] = useState<{ name: string; digest: string } | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const MAX_FILE_BYTES = 500 * 1024 * 1024; // arrayBuffer() loads it whole

  // birthday collision playground
  const [bits, setBits] = useState(20);
  const [searching, setSearching] = useState(false);
  const [progress, setProgress] = useState(0);
  const [collision, setCollision] = useState<{
    a: string; b: string; attempts: number; bits: number;
  } | null>(null);

  async function searchCollision() {
    setSearching(true);
    setCollision(null);
    setProgress(0);
    const result = await findTruncatedCollision(bits, setProgress);
    if (result) {
      setCollision({ a: result.a, b: result.b, attempts: result.attempts, bits });
    }
    setSearching(false);
  }

  const expected = Math.round(1.2533 * Math.sqrt(2 ** bits));

  return (
    <LabPage
      kicker="Module 01"
      title="Hash Functions"
      question="How can data have a fingerprint?"
      intro={
        <p>
          A cryptographic hash turns any input (a word, a file, a hard drive)
          into a fixed-size fingerprint. Same input, same fingerprint, every
          time. But change one character and the fingerprint is unrecognizable.
          Everything else in this lab is built out of this one primitive.
        </p>
      }
    >
      <Section title="Type and watch the avalanche">
        <div className="split">
          <div>
            <label htmlFor="hash-input">Input</label>
            <input
              id="hash-input"
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              spellCheck={false}
            />
            <p className="footnote" style={{ marginTop: "0.5rem" }}>
              Try flipping a single letter's case. Characters that changed
              versus the previous digest are highlighted.
            </p>
            {diffBits !== null && (
              <div className="stat-row">
                <div className="stat">
                  Bits changed <b>{diffBits} / 256</b>
                </div>
                <div className="stat">
                  Avalanche <b>{((diffBits / 256) * 100).toFixed(1)}%</b>
                </div>
              </div>
            )}
          </div>
          <div>
            <HexDigest
              label={`sha-256("${input.length > 24 ? input.slice(0, 22) + "…" : input}")`}
              value={digest}
              diffAgainst={previous?.digest}
            />
            {previous && (
              <HexDigest
                label={`previous: sha-256("${previous.input.length > 24 ? previous.input.slice(0, 22) + "…" : previous.input}")`}
                value={previous.digest}
              />
            )}
          </div>
        </div>
      </Section>

      <Section title="Fingerprint a file">
        <p>
          The same digest works for files: two parties can compare a 32-byte
          fingerprint instead of a 4&nbsp;GB download.{" "}
          <strong>The file never leaves your machine</strong>: hashing happens
          in this tab.
        </p>
        <div className="controls">
          <input
            type="file"
            aria-label="File to hash"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              // clear so re-selecting the same file re-fires onChange;
              // otherwise an edited file would keep showing its stale digest
              e.target.value = "";
              if (!file) return;
              if (file.size > MAX_FILE_BYTES) {
                setFileDigest(null);
                setFileError(
                  `${file.name} is ${(file.size / 1e6).toFixed(0)} MB; this demo reads files whole, so it caps at 500 MB. (The CLI streams in chunks and has no limit: prooflab hash yourfile)`,
                );
                return;
              }
              setFileError(null);
              setFileDigest({ name: file.name, digest: await sha256FileHex(file) });
            }}
          />
        </div>
        {fileError && <p className="notice">{fileError}</p>}
        {fileDigest && (
          <HexDigest label={`sha-256(${fileDigest.name})`} value={fileDigest.digest} />
        )}
        <p className="footnote">
          Cross-check with the CLI: <code>prooflab hash yourfile.txt</code>{" "}
          prints the identical digest.
        </p>
      </Section>

      <Section title="Try to cheat: hunt for a collision">
        <p>
          A hash is only useful if nobody can find two inputs with the same
          fingerprint. Full SHA-256 has 2<sup>256</sup> possible outputs. But
          what if we only kept the first few bits? Search for a collision on a
          truncated hash and watch the <em>birthday paradox</em> at work.
        </p>
        <div className="controls">
          <label htmlFor="bits" style={{ margin: 0 }}>Keep first</label>
          <select
            id="bits"
            value={bits}
            style={{ width: "auto" }}
            onChange={(e) => setBits(Number(e.target.value))}
            disabled={searching}
          >
            <option value={16}>16 bits</option>
            <option value={20}>20 bits</option>
            <option value={24}>24 bits</option>
          </select>
          <button className="primary" onClick={() => void searchCollision()} disabled={searching}>
            {searching ? `Searching… ${progress.toLocaleString()} hashes` : "Find a collision"}
          </button>
        </div>
        <div className="stat-row">
          <div className="stat">
            Possible outputs <b>2^{bits} = {(2 ** bits).toLocaleString()}</b>
          </div>
          <div className="stat">
            Expected attempts (birthday bound) <b>≈ {expected.toLocaleString()}</b>
          </div>
        </div>
        {collision && (
          <div className="banner invalid">
            <strong>✗ Collision found after {collision.attempts.toLocaleString()} attempts</strong>
            <ul>
              <li>
                <code>{collision.a}</code> and <code>{collision.b}</code> share
                their first {collision.bits} bits of SHA-256.
              </li>
              <li>
                Notice how close {collision.attempts.toLocaleString()} is to the
                √N birthday estimate, not to N itself.
              </li>
            </ul>
          </div>
        )}
        <p>
          Scale that intuition up: at 256 bits the birthday bound is about
          2<sup>128</sup> ≈ 3.4 × 10<sup>38</sup> attempts. Hashing a trillion
          inputs per second, that is ~10<sup>19</sup> years; the attack that
          works instantly at 20 bits simply dies at 256.
        </p>
        <MathAside>
          <p>
            With N possible outputs and k uniformly random inputs, the
            probability that all k digests are distinct is{" "}
            <code>∏(1 − i/N) ≈ e^(−k²/2N)</code>. That hits 50% at{" "}
            <code>k ≈ 1.1774·√N</code>, and the expected number of draws until
            a repeat is <code>≈ 1.2533·√N</code>, the constant used above.
            This is why a hash with n output bits offers only n/2 bits of
            collision resistance, and why 128-bit hashes (like MD5) are
            considered broken for signatures.
          </p>
        </MathAside>
      </Section>

      <Section title="What hashing buys you, and what it doesn't">
        <Guarantees
          does={[
            "Deterministic fingerprints: same data, same digest",
            "Tamper-evidence: any change is detectable",
            "One-wayness: the digest doesn't reveal the input (if the input is unguessable)",
            "Collision resistance at full output length",
          ]}
          doesnt={[
            "Hashing is NOT encryption: nothing is meant to be decrypted",
            "Doesn't hide guessable inputs: hash every 4-digit PIN and compare",
            "Doesn't prove who made the data or when",
            "Truncated hashes lose security quadratically fast",
          ]}
          world={[
            "Git identifies every commit by its hash",
            "Download pages publish checksums next to installers",
            "Password stores keep (salted, stretched) hashes, not passwords",
            "Every other module in this lab",
          ]}
        />
        <CodeBlock
          label="the whole algorithm, from the outside"
          code={`
digest = SHA256(data)        # 32 bytes, no matter how big data is

SHA256("hello")  = 2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824
SHA256("Hello")  = 185f8db32271fe25f561a6fc938b2e264306ec304eda518007d1764826381969
#                  ^ one bit of input flipped ~half of all output bits`}
        />
      </Section>
    </LabPage>
  );
}
