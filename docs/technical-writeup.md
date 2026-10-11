# Proof Without Disclosure: technical writeup

*What each primitive does, what security property it provides, what it does
not guarantee, and how this implementation works.*

---

## 0. The organizing idea

Every module in this project answers one question at increasing ambition:

> What can one party prove to another without revealing more than necessary?

The dependency chain is real, not rhetorical:

```
hash  →  commitment  →  Merkle tree        (commitments at scale)
      →  interactive ZK (graph coloring)   (commitments per round)
      →  Schnorr identification            (algebraic ZK)
      →  Fiat–Shamir                       (hash replaces the verifier)
      →  signature                         (= non-interactive ZK proof of key knowledge)
```

The punchline the lab builds toward: **a digital signature is a
zero-knowledge proof of knowledge of the private key, made non-interactive by
a hash function and bound to a message.** Modules 01–05 are the parts of that
sentence, taught separately.

---

## 1. Hash functions (SHA-256)

**What it does.** Maps arbitrary bytes to a fixed 256-bit digest,
deterministically. Only vetted implementations are used (Web Crypto in
the browser, `hashlib` in Python); this project never reimplements the
primitive.

**Properties relied on.**
- *Preimage resistance*: given `h`, finding any `m` with `H(m) = h` costs
  ~2²⁵⁶ work.
- *Second-preimage resistance*: given `m`, finding `m′ ≠ m` with the same
  digest costs ~2²⁵⁶.
- *Collision resistance*: finding **any** colliding pair costs ~2¹²⁸, the
  square root, by the birthday paradox (with N outputs, a repeat is expected
  after ≈ 1.2533·√N random draws). The website's collision playground makes
  this measurable: at 16 kept bits a collision arrives in a few hundred
  attempts, matching √(2¹⁶)·1.25 ≈ 321.
- *Avalanche*: flipping one input bit flips each output bit with probability
  ~½ (the demo shows ~48–52% consistently).

**Not guaranteed.** Hashing is not encryption (nothing is decryptable); it
does not hide guessable inputs (hash all 10⁴ PINs and compare; that is why
commitments add a salt); it says nothing about who produced the data or when.

---

## 2. Commitments

**Construction.** `commit = SHA256(utf8(salt_hex) ‖ ":" ‖ utf8(secret))`
with a fresh 16-byte random salt (`secrets.token_bytes` / 
`crypto.getRandomValues`).

**Hiding** (the commitment reveals nothing useful): without the salt, a
verifier-turned-attacker could enumerate likely secrets and compare digests.
128 bits of salt entropy make the dictionary attack pointless. Hiding here is
*computational*, inherited from SHA-256's preimage resistance.

**Binding** (the committer cannot re-open to a different value): producing
`(secret′, salt′) ≠ (secret, salt)` with the same digest is a SHA-256
collision, expected cost ~2¹²⁸. Also computational.

**Perfect vs computational.** Pedersen commitments (`g^m·h^r`) are perfectly
hiding but only computationally binding; hash commitments are the reverse
emphasis. Perfectly-both is impossible: information-theoretic binding means
the commitment uniquely determines the secret, which contradicts
information-theoretic hiding. Educationally, the hash commitment wins on
transparency: every byte is inspectable.

**Not guaranteed.** No timestamp (pair with a public, dated channel); no
forced reveal; encoding discipline matters (the spec fixes the exact
preimage bytes to prevent cross-implementation ambiguity).

---

## 3. Merkle trees

**Construction** (see format-spec §4): leaves `H(0x00‖item)`, internal nodes
`H(0x01‖left‖right)`, odd nodes promoted. A proof is the sibling path,
`⌈log₂ n⌉` hashes.

**Why domain separation.** If leaves and nodes hashed identically, the
64-byte concatenation `left‖right` of two internal hashes could be presented
*as an item*: its "leaf hash" would equal a real internal node, so a forged
proof for a never-inserted item would verify. This is a structural
second-preimage attack; RFC 6962 (Certificate Transparency) introduced the
0x00/0x01 prefixes to kill it, and this project's test suites include the
forgery attempt as a regression test (`test_forged_internal_node_leaf_rejected`).

**Why promote, not duplicate.** Bitcoin duplicates the last hash on odd
levels, so `[a,b,c]` and `[a,b,c,c]` share a root. Duplicate-ambiguity let
attackers craft blocks that some validators cached as "seen and invalid"
while an equivalent valid form existed: CVE-2012-2459, a network-splitting
bug. Promotion keeps the list→root map injective and costs one line of code.

**Guarantees.** One 32-byte root commits to the whole ordered set; proofs
are logarithmic; tampering with any item changes the root.

**Not guaranteed.** A membership proof reveals the proven item (privacy is
about the *rest* of the set); plain Merkle trees don't prove
*non*-membership (sorted or sparse variants do); the root itself must arrive
over a trusted channel; a proof against an attacker's root proves only
membership in the attacker's set.

---

## 4. Digital signatures (ECDSA P-256)

**Division of labor.** Signatures are the one primitive here where both
implementations delegate entirely to vetted code: Web Crypto
(`ECDSA`/`P-256`/`SHA-256`) in the browser, the `cryptography` package in
Python. Curve arithmetic is exactly the code one should not write oneself.

**Interop detail.** Web Crypto emits raw 64-byte `r‖s` signatures;
`cryptography` speaks DER. The CLI converts
(`decode_dss_signature`/`encode_dss_signature`) so both sides exchange the
P1363 raw form. Public keys travel as 65-byte uncompressed SEC1 points.

**Guarantees.** Authenticity (only the private-key holder signs), integrity
(any bit flip invalidates), public verifiability.

**Not guaranteed.** No confidentiality (sign ≠ encrypt); no binding of key
to *person* (that's what certificate authorities and web-of-trust add); no
timestamp; and "non-repudiation" is conditional on the key never leaking.
The Schnorr module's nonce-reuse demonstration is the cautionary tale: ECDSA
with a repeated nonce leaks the private key algebraically (Sony PS3, 2010).

---

## 5. Zero-knowledge proofs (graph 3-coloring)

**The protocol** (Goldreich–Micali–Wigderson, 1986). Public: a graph. The
prover knows a 3-coloring. Per round: prover shuffles the three color labels
with a fresh random permutation, commits to every node's shuffled color
(module-2 commitments, literally the same code), the verifier challenges
one edge, the prover opens exactly those two commitments, the verifier
accepts if the openings are valid and the colors differ.

**Completeness.** An honest prover survives every round: all edges are
properly colored under any relabeling.

**Soundness.** If the claim is false, every coloring the prover could commit
to has ≥ 1 bad edge, so a uniform challenge catches it with probability
≥ 1/|E| per round. Survival after k rounds: ≤ (1 − 1/|E|)ᵏ, exponentially
small. The website's cheat mode uses a Petersen coloring with exactly one bad
edge among 15 (the hardest cheater to catch), and the confidence meter plots
the bound live. Auto-running it, cheaters typically fall within ~15 rounds.

**Zero-knowledge.** Each accepted round reveals two different labels on one
edge, under a permutation that dies at the round's end, so observations
never compose across rounds into the real coloring. Formally: a simulator
without the witness can generate transcripts distributed identically to real
ones (pick the edge first, color its endpoints differently at random, fill
the rest with garbage commitments that are never opened). If transcripts can
be faked without the secret, transcripts cannot leak the secret.

**Why this graph problem.** 3-coloring is NP-complete (Karp, 1972), so *any*
NP statement can in principle be encoded as a graph and proven this way;
the toy protocol carries a universality theorem inside it.

**Not guaranteed / honesty notes.** This is an interactive, single-process
simulation for education; the "verifier's" randomness and the prover's
commitments run in the same tab. Real systems use non-interactive succinct
proofs (SNARKs/STARKs) with very different engineering.

---

## 6. Schnorr identification and Fiat–Shamir

**Setting.** A safe prime `p = 2q+1` and `g = 4`, which provably generates
the subgroup of quadratic residues of order `q` (squares generate the QR
subgroup; for safe primes its order is the prime `q`; the test suites
verify primality of both `p` and `q` by Miller–Rabin, and `ord(g) = q`
directly). Private key `x`, public `y = g^x mod p`.

**Protocol.** Commit `R = g^r`; challenge `c`; respond `s = r + c·x mod q`;
accept iff `g^s ≡ R·y^c (mod p)`. Correctness is two lines of algebra:
`g^(r+cx) = g^r·(g^x)^c`.

**Soundness = extraction.** Two accepting responses for one `R` yield
`x = (s₁−s₂)/(c₁−c₂) mod q`. So anything that answers two challenges *is* a
private key extractor: a prover without `x` can only pre-commit to one
guessed challenge, success probability `1/q`. In the toy group (q = 11) the
website lets you forge 550 rounds and watch ~50 slip through; in the real
group `1/q ≈ 2⁻²⁰⁴⁶`. The same equation is the nonce-reuse disaster: two
honest signatures sharing `r` hand out `x`.

**Zero-knowledge = simulation.** Choose `c, s` first and set
`R = g^s·y^(−c)`: a perfect transcript, forged without `x`. Live, the order
of moves (R before c) is what makes it convincing; Fiat–Shamir restores that
order cryptographically by deriving `c = H(group‖y‖R‖message) mod q`: the
prover cannot choose `c` first because `c` is a function of `R`. (Formally
this gives honest-verifier ZK, and security of the transform is argued in
the random-oracle model: simplifications this writeup gladly owns.)

**The punchline.** Fiat–Shamir with a message in the hash *is* a signature
scheme. Schnorr signatures (on elliptic-curve groups) are deployed today in
Bitcoin Taproot (BIP 340); Ed25519 is a descendant of the same design. The
lab's version uses modular arithmetic instead of curves so every value is
printable and the toy group fits in your head; the mathematics of the
protocol is identical.

**Deliberate weakness.** The toy group exists to be broken: the website and
CLI both include a brute-force discrete-log "attack" that recovers toy keys
instantly and visibly fails to dent the 2048-bit group (measured rate
extrapolates to ~10⁶⁰² years). Group size *is* the security parameter, and
the project makes that a lived experience rather than a sentence.

---

## 7. Engineering the interop

Two implementations with zero shared code are kept byte-compatible by:

1. **A written spec** (docs/format-spec.md) fixing every encoding decision:
   the colon in commitments, the 0x00/0x01 Merkle prefixes, fixed-width hex
   for group elements, raw `r‖s` signatures.
2. **Shared test vectors** (vectors/test-vectors.json), generated once by
   the Python side with fixed keys/nonces, verified by both suites in CI.
   The signature vector is verify-only (ECDSA signing is randomized;
   verification is deterministic).
3. **Cross-verification as a feature**: the website's drag-and-drop verifier
   accepts CLI files, and CLI `verify` commands accept website downloads,
   so every user interaction doubles as an interop test.

Python: 61 tests. TypeScript: 62 tests. CI runs both plus a type-check and
production build.

---

## 8. What this project is not

Not audited, not constant-time, not side-channel hardened, not
key-managed, not production anything. Randomness comes from the platform
CSPRNGs, but toy groups, printable transcripts, and in-process "verifiers"
are pedagogical choices that would be vulnerabilities anywhere else. The
disclaimer is not a legal formality; it is the correct security analysis of
educational software, stated plainly.
