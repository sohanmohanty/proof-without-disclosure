# Proof Without Disclosure

**An interactive cryptography lab and local toolkit about trust, privacy, and verification.**

Created by **Sohan Mohanty**.

**Live site:** <https://proof-without-disclosure.vercel.app/>

> What can mathematics let us prove without revealing more than necessary?

Cryptography is usually introduced as the art of hiding messages. This project is about the other half of the field, **proving things**: that a file hasn't changed, that a promise was made before the outcome was known, that an item belongs to a set nobody gets to see, that a message really came from you, and finally that you know a secret *without revealing it*.

## Two implementations, one spec

| Part | What it is | Where |
|---|---|---|
| **Website** | Interactive lab: six modules with live demos, "try to cheat" modes, and visual proofs, opening with a scroll-driven 3D tour whose scenes are computed from real crypto output. React + TypeScript + three.js, all cryptography client-side: no server, no uploads. | [`website/`](website/) |
| **CLI** | `prooflab`, a Python toolkit that generates and verifies the same proofs locally. Core commands use only the standard library. | [`prooflab/`](prooflab/) |
| **Spec** | Byte-level format rules both implementations follow. | [`docs/format-spec.md`](docs/format-spec.md) |
| **Shared vectors** | Test vectors generated once and verified by *both* test suites: the pin that keeps two independent implementations interoperable. | [`vectors/test-vectors.json`](vectors/test-vectors.json) |

Proofs cross the boundary in both directions: a `proof.json` generated in your terminal verifies in the website's drag-and-drop verifier, and a proof downloaded from the website verifies with `prooflab ... verify`. That is how real cryptographic standards stay honest: independent implementations checked against each other, not a single codebase checked against itself.

## The six modules

1. **Hash functions**: fingerprints for data. Watch one character flip half the output bits; brute-force collisions on truncated hashes and see the birthday bound appear empirically.
2. **Commitments**: seal a secret now, open it later, and fail publicly if you try to swap it. `SHA256(salt : secret)`, hiding + binding.
3. **Merkle trees**: one 32-byte root vouches for a whole set; membership proofs are `log₂(n)` hashes. Implements RFC 6962 domain separation (leaf `0x00` / node `0x01` prefixes) and promotes odd nodes; the README-level reason is in the module, the attack-level reason is in the [technical writeup](docs/technical-writeup.md).
4. **Digital signatures**: real ECDSA P-256 via Web Crypto (website) and the `cryptography` library (CLI). Interop formats: 65-byte uncompressed public key, 64-byte raw `r‖s` signature.
5. **Zero-knowledge proofs**: the graph 3-coloring protocol, playable. Challenge an honest prover for 100 rounds, then catch a cheating one; a confidence meter shows the soundness bound `(1 − 1/|E|)^k` tightening live.
6. **Schnorr protocol**: the capstone. A real zero-knowledge identification protocol over safe-prime groups (a hand-checkable 23-element toy group, and the 2048-bit RFC 3526 group). Brute-force the toy key, fail to brute-force the real one, then apply Fiat–Shamir and discover the punchline: **a Schnorr signature is a zero-knowledge proof of key knowledge, made non-interactive by a hash function.**

Every module ends the same way: *what this guarantees, what it does not guarantee, where you've seen it in the real world*, and a "try to cheat" interaction, because security properties only mean something when you watch cheating fail.

## Quick start

**Website (dev, from the project root):**

```bash
cd website
npm install
npm run dev        # http://localhost:5173
npm test           # 50 vitest tests, including shared-vector interop
npm run build      # static bundle in dist/, deployable to any static host
```

**CLI (from the project root):**

```bash
cd prooflab
pip install -e .                 # core: zero dependencies
pip install -e ".[signatures]"   # + ECDSA file signatures
prooflab --help
cd ..

# a taste:
prooflab commit "the winner will be team blue"
prooflab merkle prove students.txt --item student_5 --out proof.json
prooflab schnorr keygen --toy && prooflab schnorr crack schnorr_key.json
prooflab zk-color demo --rounds 30 --cheat
```

**Tests:**

```bash
cd prooflab
python -m pytest      # 61 tests
cd ../website
npx vitest run        # 50 tests
```

Both suites verify [`vectors/test-vectors.json`](vectors/test-vectors.json). From the project root, regenerate it only after a deliberate format change with `python prooflab/scripts/generate_vectors.py`.

## Why I built this

Competitive programming taught me to ask whether an algorithm is fast. Cryptography made me ask a different question: can a system be *trusted* by people who do not trust each other? This project explores the answer I found most beautiful: trust manufactured from mathematical hardness, spending no privacy in the process.

## Design principles

- **Vetted primitives, educational protocols.** SHA-256 and ECDSA come from Web Crypto / `hashlib` / `cryptography`, never hand-rolled. The protocol layer (commitments, Merkle trees, Schnorr, graph coloring) is implemented from scratch, clearly labeled, and tested, because reading it is the point.
- **Limitations are content.** Each module states what the primitive does *not* guarantee. The Merkle module explains the proof-forgery attack its design choices prevent (RFC 6962, CVE-2012-2459); the Schnorr module includes a breakable toy group *on purpose*.
- **Interaction over exposition.** You don't read that soundness error is 1/q; you forge 550 Schnorr rounds and watch ~1/11 slip through in the toy group.

## Security disclaimer

Proof Without Disclosure is an educational project. It demonstrates cryptographic concepts through interactive simulations and local tools. It is **not audited, not production-grade, and must not be used to secure sensitive real-world systems**. See [docs/security-disclaimer.md](docs/security-disclaimer.md).

## Repository layout

```
proof-without-disclosure/
|-- website/          # React + TypeScript interactive lab
|   `-- src/crypto/   # TS implementation (hash, commitments, merkle, schnorr, ...)
|-- prooflab/         # Python CLI toolkit
|   `-- prooflab/     # Python implementation of the same primitives
|-- vectors/          # shared test vectors (verified by BOTH test suites)
|-- docs/             # format spec, technical writeup, disclaimer
`-- examples/         # sample inputs to play with
```

## License

MIT. See [LICENSE](LICENSE).
