import { useEffect, useMemo, useState } from "react";
import CodeBlock from "../components/CodeBlock";
import Dropzone from "../components/Dropzone";
import Guarantees from "../components/Guarantees";
import MathAside from "../components/MathAside";
import MerkleTreeSVG from "../components/MerkleTreeSVG";
import { LabPage, Section } from "../components/LabPage";
import { downloadJson, merkleProofDoc } from "../crypto/docs";
import { bytesToHex } from "../crypto/hex";
import {
  buildTree,
  generateProof,
  hashLeaf,
  rootOf,
  verifyProof,
  type MerkleTree,
} from "../crypto/merkle";

const DEFAULT_ITEMS = [
  "alice@example.com",
  "bob@example.com",
  "carol@example.com",
  "dana@example.com",
  "erin@example.com",
  "frank@example.com",
  "grace@example.com",
].join("\n");

export default function MerkleLab() {
  const [text, setText] = useState(DEFAULT_ITEMS);
  const items = useMemo(
    () => text.split("\n").map((s) => s.trim()).filter(Boolean),
    [text],
  );
  const [tree, setTree] = useState<MerkleTree | null>(null);
  const [publishedRoot, setPublishedRoot] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [tampered, setTampered] = useState<number | null>(null);
  const [preTamperText, setPreTamperText] = useState<string | null>(null);
  const [verifyState, setVerifyState] = useState<{
    item: string; ok: boolean; steps: number;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (items.length === 0) {
      setTree(null);
      return;
    }
    void buildTree(items).then((t) => {
      if (!cancelled) {
        setTree(t);
        setSelected((s) => (s !== null && s < items.length ? s : null));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [items]);

  const proof = useMemo(
    () => (tree && selected !== null ? generateProof(tree, selected) : null),
    [tree, selected],
  );

  async function runVerification() {
    if (!tree || selected === null || !proof) return;
    const item = tree.items[selected];
    const root = publishedRoot ?? rootOf(tree);
    setVerifyState({
      item,
      ok: await verifyProof(item, proof, root),
      steps: proof.length,
    });
  }

  function tamper() {
    if (tampered !== null) return; // already tampered; restore first
    const lines = text.split("\n");
    const idx = Math.min(1, lines.length - 1);
    setPreTamperText(text); // so "restore" brings back the user's own list
    lines[idx] = "MALLORY:" + lines[idx];
    setPublishedRoot(tree ? rootOf(tree) : null); // freeze the honest root
    setText(lines.join("\n"));
    setTampered(idx);
    setVerifyState(null);
  }

  return (
    <LabPage
      kicker="Module 03"
      title="Merkle Trees"
      question="How can you prove one item belongs to a set, without showing the set?"
      intro={
        <p>
          Hash every item, then hash the hashes in pairs, and again, until one
          hash remains: the <strong>root</strong>. That single value now vouches
          for the entire list. To prove one item belongs, you hand over just
          the sibling hashes along its path: for a million items, that is 20
          hashes, not a million.
        </p>
      }
    >
      <Section title="Build a tree, pick a leaf, follow its proof">
        <div className="split">
          <div>
            <label htmlFor="items">The set (one item per line)</label>
            <textarea
              id="items"
              rows={8}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                // a manual edit starts a fresh scenario: unfreeze the root
                // so verification checks against the current list again
                setTampered(null);
                setPublishedRoot(null);
                setVerifyState(null);
              }}
            />
            <div className="stat-row">
              <div className="stat">Items <b>{items.length}</b></div>
              <div className="stat">
                Proof size <b>{proof ? proof.length : "–"} hashes</b>
              </div>
              <div className="stat">
                For 1,000,000 items <b>20 hashes</b>
              </div>
            </div>
            {tree && (
              <>
                <div className="hex-label">merkle root (publish just this)</div>
                <div className="hex">{rootOf(tree)}</div>
              </>
            )}
          </div>
          <div>
            {tree && items.length <= 16 ? (
              <>
                <MerkleTreeSVG
                  tree={tree}
                  selectedLeaf={selected}
                  onSelectLeaf={(i) => {
                    setSelected(i);
                    setVerifyState(null);
                  }}
                  tamperedLeaf={tampered}
                />
                <p className="footnote">
                  Click a leaf. Purple = the path a verifier recomputes; dashed
                  amber = the sibling hashes included in the proof.
                </p>
              </>
            ) : tree ? (
              <>
                <p className="notice">
                  {items.length} items is too many to draw, which is exactly
                  why Merkle proofs exist. Pick an item; its proof is still
                  just {Math.ceil(Math.log2(items.length))} hashes.
                </p>
                <label htmlFor="leaf-select">Item to prove</label>
                <select
                  id="leaf-select"
                  value={selected ?? ""}
                  onChange={(e) => {
                    setSelected(e.target.value === "" ? null : Number(e.target.value));
                    setVerifyState(null);
                  }}
                >
                  <option value="">choose an item…</option>
                  {items.map((item, i) => (
                    <option key={i} value={i}>
                      {item.length > 48 ? item.slice(0, 46) + "…" : item}
                    </option>
                  ))}
                </select>
              </>
            ) : (
              <p className="footnote">Add at least one item to build a tree.</p>
            )}
          </div>
        </div>
        {proof && tree && selected !== null && (
          <>
            <div className="controls">
              <button className="primary" onClick={() => void runVerification()}>
                Verify proof for "{tree.items[selected]}"
              </button>
              <button
                className="ghost"
                onClick={async () =>
                  downloadJson(
                    merkleProofDoc(
                      tree.items[selected],
                      bytesToHex(await hashLeaf(tree.items[selected])),
                      rootOf(tree),
                      proof,
                    ),
                    "proof.json",
                  )
                }
              >
                ⬇ proof.json
              </button>
            </div>
            {verifyState && (
              <div className={`banner ${verifyState.ok ? "valid" : "invalid"}`}>
                <strong>
                  {verifyState.ok
                    ? `✓ "${verifyState.item}" is in the set`
                    : `✗ Proof failed against the published root`}
                </strong>
                <ul>
                  <li>
                    Recomputed leaf → root using {verifyState.steps} sibling
                    hashes{verifyState.ok
                      ? ", and reached the published root exactly."
                      : ", and reached a different root. Something changed."}
                  </li>
                </ul>
              </div>
            )}
          </>
        )}
      </Section>

      <Section title="Try to cheat: edit the list after publishing the root">
        <p>
          The whole point of a Merkle root is that it freezes the set. Publish
          the root, then let Mallory tamper with an item: every proof against
          the <em>old</em> root now fails.
        </p>
        <div className="controls">
          <button className="danger" onClick={tamper} disabled={!tree}>
            Tamper with item #2
          </button>
          {publishedRoot && (
            <button
              className="ghost"
              onClick={() => {
                setText(preTamperText ?? DEFAULT_ITEMS);
                setPreTamperText(null);
                setTampered(null);
                setPublishedRoot(null);
                setVerifyState(null);
              }}
            >
              Restore the honest list
            </button>
          )}
        </div>
        {publishedRoot && tree && (
          <>
            <div className="hex-label">root published before tampering</div>
            <div className="hex">{publishedRoot}</div>
            <div className="hex-label">root of the current (tampered) list</div>
            <div className="hex">
              {[...rootOf(tree)].map((ch, i) => (
                <span key={i} className={ch !== publishedRoot[i] ? "diff" : ""}>{ch}</span>
              ))}
            </div>
            <p className="footnote">
              Select the tampered leaf and press Verify: the proof is checked
              against the frozen root and fails.
            </p>
          </>
        )}
      </Section>

      <Section title="Verify a proof from the CLI">
        <p>
          Generate a proof on your machine with{" "}
          <code>prooflab merkle prove students.txt --item student_42</code>,
          then drop <code>proof.json</code> here. The browser recomputes the
          path without ever seeing the rest of your list.
        </p>
        <Dropzone hint="Drop a proof.json generated by prooflab" />
      </Section>

      <Section title="Design choices that block real attacks">
        <p>
          Two details in this implementation exist because omitting them broke
          real systems:
        </p>
        <CodeBlock
          label="domain separation (RFC 6962, Certificate Transparency)"
          code={`
leaf  = SHA256(0x00 || item)          # leaves and internal nodes
node  = SHA256(0x01 || left || right) # live in different namespaces

# Without the prefixes, the 64-byte string (left||right) could be
# replayed as a "leaf", letting an attacker prove membership of an
# item that was never in the list (a second-preimage forgery).`}
        />
        <CodeBlock
          label="odd nodes are promoted, not duplicated"
          code={`
[a b c]  ->  [H(a,b) c]  ->  root     # c is carried up unchanged

# Bitcoin instead duplicates the last hash: [a b c c]. That makes two
# DIFFERENT lists share a root: the ambiguity behind CVE-2012-2459,
# which could crash nodes into rejecting valid blocks.`}
        />
        <Guarantees
          does={[
            "One 32-byte root commits to the entire set",
            "Membership proofs are log₂(n) hashes",
            "Any change to any item changes the root",
            "The verifier never needs the full list",
          ]}
          doesnt={[
            "The proof reveals the item being proven (it hides the REST of the set)",
            "Doesn't prove non-membership (that needs sorted/sparse trees)",
            "The root must come from a channel you already trust",
          ]}
          world={[
            "Certificate Transparency logs every TLS certificate issued",
            "Bitcoin/Ethereum blocks commit to transactions by root",
            "Git's object DAG is a Merkle structure",
            "Software update systems prove packages against a signed root",
          ]}
        />
        <MathAside>
          <p>
            Verification does <code>⌈log₂ n⌉</code> hashes versus <code>n</code>{" "}
            for rechecking the list: for a billion items, 30 instead of
            10⁹. Forging a proof means finding some sibling path whose folded
            hash equals the root: a structured second-preimage attack on
            SHA-256, expected cost ~2²⁵⁶ (domain separation is what stops the
            cheaper structural shortcut). The promote-rule also keeps the
            list→root map injective among lists of distinct items, which the
            duplication rule famously does not.
          </p>
        </MathAside>
      </Section>
    </LabPage>
  );
}
