import CodeBlock from "../components/CodeBlock";
import Dropzone from "../components/Dropzone";
import { LabPage, Section } from "../components/LabPage";
import { REPO_URL } from "../site";

const COMMANDS: [string, string][] = [
  ["prooflab hash notes.pdf --out notes.hash.json", "fingerprint a file; verify later with --verify"],
  ['prooflab commit "my prediction"', "seal a secret → commitment.json (public) + reveal.json (private)"],
  ["prooflab reveal --commitment commitment.json --reveal reveal.json", "check a reveal against a commitment"],
  ["prooflab merkle build students.txt --out tree.json", "build a Merkle tree from a list"],
  ['prooflab merkle prove students.txt --item "student_42"', "prove one item is in the list → proof.json"],
  ["prooflab merkle verify --proof proof.json", "verify a membership proof"],
  ["prooflab keygen && prooflab sign msg.txt --key keys/private.pem", "ECDSA P-256 keys + file signatures"],
  ["prooflab verify-sig msg.txt --signature signature.json", "verify a file signature"],
  ["prooflab schnorr keygen --toy", "discrete-log key pair (toy or 2048-bit group)"],
  ['prooflab schnorr prove --key schnorr_key.json --message "hi"', "non-interactive ZK proof of key knowledge"],
  ["prooflab schnorr crack schnorr_key.json", "brute-force a private key (educational: only --toy falls)"],
  ["prooflab zk-color demo --rounds 30 --cheat", "watch a cheating prover get caught"],
];

export default function Toolkit() {
  return (
    <LabPage
      kicker="Local Toolkit"
      title="prooflab — the lab on your own machine"
      question="Why trust a website when you can run the math yourself?"
      intro={
        <p>
          Everything this site demonstrates also runs locally as a Python CLI.
          Same formats, same byte-level rules, two independent
          implementations: proofs made in your terminal verify in this browser,
          and proofs downloaded here verify in your terminal.
        </p>
      }
    >
      <Section title="Install">
        <CodeBlock
          code={`
git clone ${REPO_URL}.git
cd proof-without-disclosure/prooflab
pip install -e .              # core: zero dependencies (stdlib only)
pip install -e ".[signatures]"  # + ECDSA signatures (vetted 'cryptography' lib)

prooflab --help`}
        />
        <p className="footnote">
          Python 3.10+. The core commands (hash, commit, merkle, schnorr,
          zk-color) use only the standard library — every line of protocol
          logic is{" "}
          <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
            in the repo to read
          </a>
          .
        </p>
      </Section>

      <Section title="Command reference">
        <table className="cmd-table">
          <thead>
            <tr>
              <th>Command</th>
              <th>What it does</th>
            </tr>
          </thead>
          <tbody>
            {COMMANDS.map(([cmd, what]) => (
              <tr key={cmd}>
                <td><code>{cmd}</code></td>
                <td>{what}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="A five-minute session">
        <CodeBlock
          code={`
$ echo student_1 student_2 student_3 student_4 student_5 | tr ' ' '\\n' > students.txt

$ prooflab merkle build students.txt --out tree.json
items       = 5
merkle root = 7d3f0e6a…

$ prooflab merkle prove students.txt --item student_4 --out proof.json
proof steps = 3  (vs 5 items in the set)
  saved -> proof.json

$ prooflab merkle verify --proof proof.json
[ok] proof valid
  "student_4" is in the set committed to by root 7d3f0e6a…

# now drag proof.json into the box below — the browser agrees.`}
        />
      </Section>

      <Section title="Universal verifier — the interop test">
        <p>
          Drop <em>any</em> prooflab JSON file. The browser detects the type
          and verifies it with an implementation that shares not a single line
          of code with the CLI — only a spec (<code>docs/format-spec.md</code>)
          and a pinned set of shared test vectors. That is how real
          cryptographic standards stay honest.
        </p>
        <Dropzone />
      </Section>

      <Section title="Why a CLI at all?">
        <p>
          Because "trust me, the website says it verifies" misses the point of
          the whole project. A proof you can carry away as a file, check with
          independent software, and re-derive from a written spec is a proof
          that does not ask for trust. The website makes the ideas visible;
          the toolkit makes them yours.
        </p>
      </Section>
    </LabPage>
  );
}
