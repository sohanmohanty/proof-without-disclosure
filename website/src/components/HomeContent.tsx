import { Link } from "react-router-dom";

const MODULES = [
  {
    to: "/hash",
    num: "01",
    title: "Hash Functions",
    blurb:
      "How can data have a fingerprint? Watch one character change everything, and hunt for collisions.",
  },
  {
    to: "/commitments",
    num: "02",
    title: "Commitments",
    blurb:
      "How can you lock in a secret now and prove later that you never changed it?",
  },
  {
    to: "/merkle",
    num: "03",
    title: "Merkle Trees",
    blurb:
      "How can one short root vouch for a whole dataset, and a few hashes prove membership?",
  },
  {
    to: "/signatures",
    num: "04",
    title: "Digital Signatures",
    blurb:
      "How can a message prove who wrote it and that nobody touched it since?",
  },
  {
    to: "/zero-knowledge",
    num: "05",
    title: "Zero-Knowledge Proofs",
    blurb:
      "How can you convince a skeptic you know a solution, without showing it?",
  },
  {
    to: "/schnorr",
    num: "06",
    title: "Schnorr Protocol",
    blurb:
      "Real zero-knowledge, real algebra: prove you hold a private key without revealing it.",
  },
];

/** The module grid + framing sections shared by the classic home page and
 * the 3D journey landing (which renders it below the scroll experience). */
export default function HomeContent() {
  return (
    // tabIndex -1: focus target for the journey's "skip the tour" control
    <div id="modules" tabIndex={-1}>
      <div className="module-grid">
        {MODULES.map((m) => (
          <Link key={m.to} to={m.to} className="module-card">
            <span className="num">{m.num}</span>
            <h3>{m.title}</h3>
            <p>{m.blurb}</p>
          </Link>
        ))}
        <Link to="/toolkit" className="module-card">
          <span className="num">CLI</span>
          <h3>Local Toolkit</h3>
          <p>
            Download <code>prooflab</code> and generate the same proofs on
            your own machine, then verify them here.
          </p>
        </Link>
      </div>

      <section className="section">
        <h2>One idea, six angles</h2>
        <p>
          Cryptography is usually introduced as the art of hiding messages.
          This lab is about the other half of the field: <em>proving</em>{" "}
          things. Each module answers the same question at a higher level of
          ambition: what can one person prove to another without revealing
          more than necessary?
        </p>
        <p>
          The modules build on each other. Hashes give data a fingerprint.
          A commitment is a hash you publish <em>before</em> the reveal.
          A Merkle tree is thousands of commitments folded into one root.
          A signature proves an identity stands behind a message. And
          zero-knowledge proofs push the idea to its logical extreme:
          conviction without disclosure. The final module shows the punchline
          hiding in the mathematics: <strong>a Schnorr signature is just a
          zero-knowledge proof made non-interactive by a hash function</strong>.
          The pieces were one machine all along.
        </p>
      </section>

      <p className="philosophy">
        Cryptography is not only about secrecy. It is about designing systems
        where truth can be checked, privacy can be preserved, and trust does
        not have to be assumed.
      </p>
    </div>
  );
}
