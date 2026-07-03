# prooflab

Educational cryptography toolkit — the command-line half of
[Proof Without Disclosure](../README.md). Generate and verify hashes,
commitments, Merkle membership proofs, ECDSA signatures, and Schnorr
zero-knowledge proofs on your own machine. Files it writes verify in the
project website's drag-and-drop verifier, and vice versa.

> Educational use only: not audited, not production security software.

## Install

```bash
pip install -e .                 # core — zero dependencies (stdlib only)
pip install -e ".[signatures]"   # + ECDSA file signatures ('cryptography')
pip install -e ".[dev]"          # + pytest and signature test dependencies
```

Python 3.10+.

## Commands

```text
prooflab hash FILE [--out r.json] [--verify DIGEST|r.json]
prooflab commit "secret" [--out commitment.json] [--out-reveal reveal.json]
prooflab reveal --commitment commitment.json (--reveal reveal.json | --secret S --salt HEX)

prooflab merkle build  LIST.txt [--out tree.json]
prooflab merkle prove  LIST.txt (--item X | --index N) [--out proof.json]
prooflab merkle verify --proof proof.json [--root HEX] [--item X]

prooflab keygen [--dir keys/]
prooflab sign FILE --key keys/private.pem [--out signature.json]
prooflab verify-sig FILE --signature signature.json

prooflab schnorr keygen [--toy] [--out key.json]
prooflab schnorr prove  --key key.json [--message MSG] [--out proof.json]
prooflab schnorr verify --proof proof.json
prooflab schnorr crack  KEY_OR_PROOF.json     # succeeds only on --toy keys

prooflab zk-color demo [--rounds N] [--cheat] [--seed N] [--stop-when-caught]
```

## A session

```console
$ prooflab commit "the winner will be team blue"
commitment = 7ac9c2…        # share this now
salt       = 1b7f30…        # keep private
  saved -> commitment.json
  saved -> reveal.json

$ prooflab reveal --commitment commitment.json --reveal reveal.json
[ok] reveal matches the commitment

$ prooflab schnorr keygen --toy --out key.json
$ prooflab schnorr crack key.json
[FAIL] private key recovered: x = 7
  toy groups are for learning; security needs ~2048-bit groups

$ prooflab zk-color demo --rounds 300 --cheat --stop-when-caught
  round   1: edge (2,7) opened -> colors (1,3)  accept
  ...
  round  14: edge (3,4) opened -> colors (2,2)  REJECT -- caught!
```

## Design notes

- Formats are specified in [`docs/format-spec.md`](../docs/format-spec.md)
  and pinned by [`vectors/test-vectors.json`](../vectors/test-vectors.json),
  which this package's tests and the website's tests both verify.
- Educational protocols (commitments, Merkle, Schnorr, zk-color) are
  implemented from scratch in readable stdlib Python. Real primitives
  (SHA-256, ECDSA) come from `hashlib` and `cryptography`.
- Merkle trees use RFC 6962 domain separation and promote odd nodes;
  the module docstrings explain the attacks those choices prevent.

## Tests

```bash
pip install -e ".[dev]"
python -m pytest      # 61 tests, includes the shared interop vectors
```
