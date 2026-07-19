# prooflab format specification (v1)

This document defines the byte-level rules that make the Python CLI and the
TypeScript website interoperable. Both implementations are tested against
[`vectors/test-vectors.json`](../vectors/test-vectors.json), which pins every
rule below. If you re-implement this spec in another language and your output
matches the vectors, your implementation interoperates too.

Conventions: `H(x)` is SHA-256; `hex(...)` is lowercase hexadecimal;
`utf8(...)` is UTF-8 encoding of a string; `‖` is byte concatenation.

## 1. JSON envelope

Every document is a JSON object with at least:

```json
{ "format": "prooflab", "version": 1, "type": "<document type>" }
```

Verifiers must reject documents whose `format` is not `"prooflab"` or whose
`version` is not `1`. Additional fields `created_at` (ISO 8601) and `note`
are informational and never verified. Document types:
`file_hash`, `commitment`, `commitment_reveal`, `merkle_tree`,
`merkle_proof`, `signature`, `schnorr_proof`, `schnorr_keypair`.

## 2. Hashing

- `file_hash.digest` = `hex(H(file bytes))`.
- `file_hash.file_name` is informational; verification uses the bytes supplied
  by the user, not the recorded name.
- Text hashing (everywhere below) hashes `utf8(text)`: no BOM, no
  normalization, no trailing newline.

## 3. Commitments

```
salt        = 16 random bytes, encoded as 32 lowercase hex chars
commitment  = hex(H( utf8(salt_hex) ‖ ":" ‖ utf8(secret) ))
```

The preimage is the **ASCII hex spelling** of the salt, a single colon
(0x3A), then the secret's UTF-8 bytes. Example (from the vectors):

```
salt   = 00112233445566778899aabbccddeeff
secret = hello
commitment = H(utf8("00112233445566778899aabbccddeeff:hello"))
```

Fields: `commitment` documents carry `commitment`; `commitment_reveal`
documents carry `secret` and `salt`. Verification recomputes and compares
(commitment compared case-insensitively after trimming).

## 4. Merkle trees

Domain separation (RFC 6962 style):

```
leaf(item)         = H( 0x00 ‖ utf8(item) )
node(left, right)  = H( 0x01 ‖ left ‖ right )      # left/right are 32 raw bytes
```

Tree construction over a non-empty ordered list:

1. Level 0 = `leaf(item)` for each item, in order.
2. Each next level pairs adjacent nodes left-to-right:
   `parent = node(level[2i], level[2i+1])`.
3. **Odd rule = promote**: a trailing unpaired node is carried up unchanged
   (never duplicated).
4. The root is the single node of the top level, `hex`-encoded.

Proofs (`merkle_proof`): `item` (the raw string), `leaf_hash`, `root`, and
`path`, an ordered array of steps `{ "position": "left"|"right", "hash": <hex> }`,
bottom-up. `position` is the **sibling's** side. A promoted node contributes
no step at that level. Verification:

```
current = leaf(item)
for step in path:
    current = node(sibling, current)   if step.position == "left"
    current = node(current, sibling)   if step.position == "right"
accept iff hex(current) == root
```

Tree documents (`merkle_tree`) carry `root`, `leaf_count`, and `levels`, where
`levels` is the full tree as lowercase hex strings. Verifiers only need the
root plus a proof path; full trees are included for inspection and teaching.

## 5. Signatures

Algorithm `ecdsa-p256-sha256` (NIST P-256 / secp256r1, SHA-256 over the raw
message bytes).

- `public_key` = 65-byte uncompressed SEC1 point `0x04 ‖ X ‖ Y`, hex (130 chars).
- `signature` = 64-byte IEEE P1363 raw form `r ‖ s` (32 big-endian bytes
  each), hex (128 chars). This is Web Crypto's native ECDSA output; DER-based
  implementations must convert.
- `file_name` is informational. The signature covers the file bytes supplied
  during verification, not the recorded name.

## 6. Schnorr proofs

Groups: safe prime `p = 2q + 1`, generator `g = 4` (order exactly `q` for
every safe prime > 5):

| `group` | p | notes |
|---|---|---|
| `toy-23` | 23 | q = 11; deliberately breakable classroom group |
| `modp-2048` | RFC 3526 group 14 prime | q = (p−1)/2, 2048-bit |

Integer encoding: fixed-width big-endian, zero-padded to the byte length of
`p` (1 byte for `toy-23`, 256 bytes for `modp-2048`), lowercase hex. All of
`public_key` (y), `commitment` (R), `response` (s) use this width, including
`s`, even though `s < q`.

Key pair: private `x ∈ [1, q−1]`, public `y = g^x mod p`.

Keypair documents (`schnorr_keypair`) contain both `private_key` and
`public_key`, fixed-width encoded as above. They are secret-bearing files.
Proof documents (`schnorr_proof`) contain `group`, `public_key`,
`commitment`, `response`, and `message`.

Fiat–Shamir challenge over `utf8` of a pipe-joined string:

```
c = int( H( utf8("prooflab-schnorr-v1" + "|" + group + "|" + hex_p(y) + "|" + hex_p(R) + "|" + message) ), 16 ) mod q
```

where `hex_p(...)` is the fixed-width encoding above and `group` is the group
name string. Proof generation: random nonce `r ∈ [1, q−1]`, `R = g^r mod p`,
`s = (r + c·x) mod q`. Verification:

```
require 1 < y < p,  1 ≤ R < p,  0 ≤ s < q
accept iff g^s ≡ R · y^c (mod p)     with c recomputed as above
```

## 7. Shared test vectors

`vectors/test-vectors.json` contains, for each area: inputs and the exact
expected outputs (digests, commitments, roots, proof paths, Schnorr
transcripts with fixed nonces, and one recorded ECDSA signature that
verifiers must accept). Vectors are generated by
`prooflab/scripts/generate_vectors.py` and consumed by
`prooflab/tests/test_vectors.py` and `website/src/tests/vectors.test.ts`.
