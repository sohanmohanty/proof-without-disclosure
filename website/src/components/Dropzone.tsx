import { useRef, useState } from "react";
import { parseDoc, verifyDoc, type ProoflabDoc, type VerifyOutcome } from "../crypto/format";
import ResultBanner from "./ResultBanner";

/** Universal prooflab-file verifier: drop JSON documents (and, for
 * signatures, the signed file itself) and they are parsed, paired, and
 * verified locally. This is the CLI↔website interop surface. */
export default function Dropzone(props: { hint?: string }) {
  const [drag, setDrag] = useState(false);
  const [outcomes, setOutcomes] = useState<VerifyOutcome[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: File[]) {
    if (files.length === 0) return;
    const docs: ProoflabDoc[] = [];
    const errors: VerifyOutcome[] = [];
    let messageBytes: Uint8Array | undefined;
    let messageName = "";

    for (const file of files) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      try {
        docs.push(parseDoc(new TextDecoder().decode(bytes)));
      } catch {
        // not a prooflab JSON; treat it as the message file for a signature
        messageBytes = bytes;
        messageName = file.name;
      }
    }

    const results: VerifyOutcome[] = [...errors];
    if (docs.length === 0 && messageBytes) {
      results.push({
        verdict: "info",
        title: `Loaded ${messageName}`,
        details: ["Add a prooflab JSON document to verify against it."],
      });
    }
    for (const doc of docs) {
      const companions = docs.filter((d) => d !== doc);
      try {
        results.push(await verifyDoc(doc, companions, messageBytes));
      } catch (err) {
        results.push({
          verdict: "invalid",
          title: "Could not verify document",
          details: [err instanceof Error ? err.message : String(err)],
        });
      }
    }
    // deduplicate paired commitment/reveal outcomes
    const seen = new Set<string>();
    setOutcomes(
      results.filter((r) => {
        const key = r.title + r.details.join("|");
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }),
    );
  }

  return (
    <div>
      <div
        className={`dropzone ${drag ? "drag" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          void handleFiles(Array.from(e.dataTransfer.files));
        }}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          onChange={(e) => {
            // capture the files, then clear the input: a same-named file
            // re-selected later must still fire onChange (browsers skip the
            // event when the input's value is unchanged)
            const files = Array.from(e.target.files ?? []);
            e.target.value = "";
            void handleFiles(files);
          }}
        />
        <p>
          <strong>Drop prooflab files here</strong> (or click to browse)
        </p>
        <p className="footnote">
          {props.hint ??
            "proof.json, commitment.json + reveal.json, schnorr_proof.json, or signature.json plus the signed file. Verification happens in your browser; nothing is uploaded."}
        </p>
      </div>
      {outcomes.map((o, i) => (
        <ResultBanner key={i} outcome={o} />
      ))}
    </div>
  );
}
