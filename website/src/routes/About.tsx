import { LabPage, Section } from "../components/LabPage";
import CodeBlock from "../components/CodeBlock";

export default function About() {
  return (
    <LabPage
      kicker="About"
      title="About this project"
      question="Trust without exposure — can mathematics deliver both?"
    >
      <Section title="What this is">
        <p>
          Built by <strong>Sohan Mohanty</strong>.
        </p>
        <p>
          Proof Without Disclosure is an interactive cryptography lab and local
          toolkit exploring one question: <em>what can one person prove to
          another without revealing more than necessary?</em> Six modules walk
          a single path — fingerprints (hashes), sealed envelopes
          (commitments), set membership (Merkle trees), identity (signatures),
          and conviction without disclosure (zero-knowledge, then the Schnorr
          protocol that ties every module together).
        </p>
        <p>
          Cryptography is usually taught as secrecy. The more consequential
          half of the field is <strong>proof</strong>: integrity, authenticity,
          verification, selective disclosure. Those are social guarantees
          manufactured from mathematical hardness — and they are what let
          people who do not trust each other cooperate anyway.
        </p>
      </Section>

      <Section title="How it is built">
        <ul>
          <li>
            <strong>Website</strong> — React + TypeScript. All cryptography
            runs client-side (Web Crypto for SHA-256 and ECDSA; native BigInt
            for group arithmetic). No backend, no uploads, no analytics.
          </li>
          <li>
            <strong>CLI</strong> — <code>prooflab</code>, a Python package
            whose core uses only the standard library.
          </li>
          <li>
            <strong>One spec, two implementations</strong> — every proof file
            follows <code>docs/format-spec.md</code>; a shared test-vector file
            is verified by both test suites on every commit, so the browser and
            the CLI provably compute the same bytes.
          </li>
          <li>
            <strong>Deliberate details</strong> — RFC 6962 domain separation in
            the Merkle trees (with the forgery it prevents demonstrated), odd
            nodes promoted rather than duplicated (CVE-2012-2459), safe-prime
            Schnorr groups from RFC 3526 with generator order verified by
            primality tests in CI.
          </li>
        </ul>
        <CodeBlock
          label="the dividing line this project respects"
          code={`
real primitives   -> vetted implementations (Web Crypto, hashlib, 'cryptography')
educational       -> implemented from scratch, clearly labeled, tested
protocols            (commitments, Merkle trees, Schnorr, graph coloring)`}
        />
      </Section>

      <Section title="Honest limitations">
        <p>
          This is an educational project. It is not audited, not
          production-grade, and must not be used to protect sensitive
          real-world data. The toy Schnorr group is breakable on purpose. The
          graph-coloring protocol is a classroom illustration, not a deployed
          proof system. Where the lab simplifies, the module pages say so
          explicitly — in cryptography, knowing what a tool does <em>not</em>{" "}
          guarantee is half of understanding it.
        </p>
      </Section>

      <Section title="Standards and sources">
        <ul>
          <li>FIPS 180-4 (SHA-256); NIST example vectors pin both implementations.</li>
          <li>RFC 6962 (Certificate Transparency) — Merkle domain separation.</li>
          <li>RFC 3526 — the 2048-bit MODP group behind the real Schnorr arena.</li>
          <li>Schnorr (1991), Fiat–Shamir (1986) — identification and its hash-based transform.</li>
          <li>Goldreich–Micali–Wigderson (1986) — zero-knowledge for 3-coloring, and thus all of NP.</li>
        </ul>
      </Section>
    </LabPage>
  );
}
