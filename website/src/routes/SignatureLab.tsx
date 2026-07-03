import { useState } from "react";
import CodeBlock from "../components/CodeBlock";
import Dropzone from "../components/Dropzone";
import Guarantees from "../components/Guarantees";
import HexDigest from "../components/HexDigest";
import MathAside from "../components/MathAside";
import { LabPage, Section } from "../components/LabPage";
import { downloadJson, signatureDoc } from "../crypto/docs";
import { utf8 } from "../crypto/hex";
import {
  exportPublicKeyHex,
  generateKeyPair,
  sign,
  verify,
} from "../crypto/signatures";

interface Identity {
  name: string;
  pair: CryptoKeyPair;
  publicHex: string;
}

export default function SignatureLab() {
  const [alice, setAlice] = useState<Identity | null>(null);
  const [mallory, setMallory] = useState<Identity | null>(null);
  const [message, setMessage] = useState("I, Alice, approve invoice #4172 for $500.");
  const [signedMessage, setSignedMessage] = useState<string | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [result, setResult] = useState<{ ok: boolean; why: string } | null>(null);

  async function makeIdentity(name: string): Promise<Identity> {
    const pair = await generateKeyPair();
    return { name, pair, publicHex: await exportPublicKeyHex(pair.publicKey) };
  }

  async function generate() {
    setAlice(await makeIdentity("Alice"));
    setMallory(await makeIdentity("Mallory"));
    setSignature(null);
    setSignedMessage(null);
    setResult(null);
  }

  async function doSign() {
    if (!alice) return;
    setSignature(await sign(alice.pair.privateKey, utf8(message)));
    setSignedMessage(message);
    setResult(null);
  }

  async function doVerify(publicKeyHex: string, label: string) {
    if (!signature) return;
    const ok = await verify(publicKeyHex, utf8(message), signature);
    const edited = signedMessage !== null && signedMessage !== message;
    setResult({
      ok,
      why: ok
        ? `The current text is exactly what ${label} signed.`
        : edited && label === "Alice"
          ? "The message was edited after signing — even one character breaks the signature."
          : `This signature was not produced by ${label}'s private key.`,
    });
  }

  return (
    <LabPage
      kicker="Module 04"
      title="Digital Signatures"
      question="How can a message prove who sent it — and that nobody changed it?"
      intro={
        <p>
          A signature key comes in two halves. The <strong>private key</strong>{" "}
          signs; the matching <strong>public key</strong> verifies. Anyone can
          check, only the key-holder can produce — that asymmetry is what
          hand-written signatures always wished they had. (Real ECDSA P-256 via
          your browser's Web Crypto API, not a simulation.)
        </p>
      }
    >
      <Section title="Step 1 — Two identities">
        <div className="controls">
          <button className="primary" onClick={() => void generate()}>
            {alice ? "Regenerate key pairs" : "Generate key pairs"}
          </button>
        </div>
        {alice && mallory && (
          <div className="split">
            <div>
              <HexDigest label="Alice's public key (share freely)" value={alice.publicHex} />
              <p className="footnote">
                Alice's private key stays inside this tab. Signing proves she
                holds it — without showing it.
              </p>
            </div>
            <div>
              <HexDigest label="Mallory's public key" value={mallory.publicHex} />
              <p className="footnote">
                Mallory is here to demonstrate failure: wrong key, wrong
                verdict.
              </p>
            </div>
          </div>
        )}
      </Section>

      <Section title="Step 2 — Sign, then try to break it">
        <label htmlFor="msg">Message</label>
        <textarea
          id="msg"
          rows={3}
          value={message}
          onChange={(e) => {
            setMessage(e.target.value);
            setResult(null);
          }}
        />
        <div className="controls">
          <button className="primary" onClick={() => void doSign()} disabled={!alice}>
            Sign as Alice
          </button>
          <button
            className="ghost"
            onClick={() => alice && void doVerify(alice.publicHex, "Alice")}
            disabled={!signature}
          >
            Verify with Alice's key
          </button>
          <button
            className="danger"
            onClick={() => mallory && void doVerify(mallory.publicHex, "Mallory")}
            disabled={!signature}
          >
            Verify with Mallory's key
          </button>
          {signature && alice && (
            <button
              className="ghost"
              onClick={() =>
                downloadJson(signatureDoc("message.txt", alice.publicHex, signature), "signature.json")
              }
            >
              ⬇ signature.json
            </button>
          )}
        </div>
        {signature && (
          <HexDigest label="signature (64 bytes: r ∥ s)" value={signature} />
        )}
        {result && (
          <div className={`banner ${result.ok ? "valid" : "invalid"}`}>
            <strong>{result.ok ? "✓ Signature valid" : "✗ Signature INVALID"}</strong>
            <ul><li>{result.why}</li></ul>
          </div>
        )}
        {signedMessage && (
          <p className="footnote">
            Try to cheat: edit one character of the message above, then verify
            with Alice's key again. Or check whether Mallory can claim Alice's
            words as her own.
          </p>
        )}
      </Section>

      <Section title="Verify a CLI signature">
        <p>
          Sign a file on your machine —{" "}
          <code>prooflab sign message.txt --key private.pem</code> — then drop
          both <code>signature.json</code> and the original file here. The
          formats are identical: an uncompressed P-256 public key and a raw
          r∥s signature.
        </p>
        <Dropzone hint="Drop signature.json together with the file it signs" />
      </Section>

      <Section title="What a signature really says">
        <Guarantees
          does={[
            "Authenticity: only the private-key holder could have signed",
            "Integrity: any post-signing edit is detected",
            "Public verifiability: no secrets needed to check",
            "The message is bound to one specific key pair",
          ]}
          doesnt={[
            "Doesn't hide the message — signatures are not encryption",
            "Doesn't prove the key belongs to a PERSON (that's what certificates add)",
            "Doesn't prove when it was signed",
            "'Non-repudiation' holds only if the private key never leaks",
          ]}
          world={[
            "Every HTTPS certificate is a signature chain",
            "OS and app updates are signed before installation",
            "Git commits and release tags can be signed",
            "Passports and payment cards carry signed chips",
          ]}
        />
        <CodeBlock
          label="the flow"
          code={`
keygen:  (private, public) = new ECDSA P-256 pair
sign:    signature = Sign(private, message)
verify:  Verify(public, message, signature) -> true | false

# vetted implementations only (Web Crypto here, 'cryptography' in the
# CLI) — signing algorithms are where hand-rolled code gets people hurt`}
        />
        <MathAside>
          <p>
            ECDSA verification checks an algebraic relation between the
            message hash, the signature pair (r, s), and the public-key point
            on the P-256 curve — forging it without the private key requires
            solving the elliptic-curve discrete-log problem. The next two
            modules make that phrase concrete: module 06 builds a signature
            from discrete logs right in front of you, and shows that a
            signature <em>is</em> a zero-knowledge proof of key knowledge.
            One warning the math makes vivid: ECDSA needs a fresh random nonce
            per signature. Sony reused one on the PlayStation 3 in 2010 and
            fans extracted the console's master signing key.
          </p>
        </MathAside>
      </Section>
    </LabPage>
  );
}
