# Security disclaimer

Proof Without Disclosure is an **educational** cryptography project. It
demonstrates cryptographic concepts through interactive simulations and
local tools.

- It is **not audited**.
- It is **not production-grade**.
- It must **not** be used to secure sensitive real-world systems or data.

Specific, deliberate departures from production practice:

1. **The toy Schnorr group (p = 23) is breakable by hand, on purpose.**
   Its entire role is to make discrete-log attacks watchable. Only the
   2048-bit RFC 3526 group illustrates realistic hardness, and even that
   usage here is educational, not hardened.
2. **Educational protocols are hand-implemented.** Commitments, Merkle
   trees, Schnorr, and the graph-coloring protocol are written for clarity,
   not constant-time execution or side-channel resistance.
3. **In-process "verifiers."** The website's interactive protocols simulate
   both prover and verifier inside one browser tab. Real deployments
   separate parties, transports, and trust domains.
4. **No key management.** Keys live in memory or plain JSON/PEM files with
   no protection. `schnorr_key.json`, `keys/private.pem`, and `reveal.json`
   contain secrets and are written unencrypted by design, so learners can read
   them.

Where real primitives are needed (SHA-256, ECDSA P-256), the project uses
vetted implementations (the browser's Web Crypto API, Python's `hashlib`,
and the `cryptography` package) and never reimplements them.

If you need real security: use maintained, audited libraries and protocols
(libsodium, TLS, age, signify, …), not this project.
