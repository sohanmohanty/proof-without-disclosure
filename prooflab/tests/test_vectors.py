"""Re-verify every shared test vector. The TypeScript suite runs the same
file; this is what keeps two independent implementations interoperable."""

import json
from pathlib import Path

import pytest

from prooflab import commitments, hashing, merkle, schnorr

VECTORS_PATH = Path(__file__).resolve().parents[2] / "vectors" / "test-vectors.json"


@pytest.fixture(scope="module")
def vectors():
    assert VECTORS_PATH.exists(), (
        "shared vectors missing; run: python scripts/generate_vectors.py"
    )
    return json.loads(VECTORS_PATH.read_text(encoding="utf-8"))


def test_sha256_vectors(vectors):
    for case in vectors["sha256"]:
        assert hashing.hash_text(case["text"]) == case["sha256"]


def test_commitment_vectors(vectors):
    for case in vectors["commitments"]:
        assert commitments.compute_commitment(
            case["secret"], case["salt"]) == case["commitment"]
        assert commitments.verify_reveal(
            case["commitment"], case["secret"], case["salt"])


def test_merkle_vectors(vectors):
    for case in vectors["merkle"]:
        tree = merkle.build_tree(case["items"])
        assert tree.root == case["root"]
        proof = case["proof"]
        assert merkle.hash_leaf(proof["item"]).hex() == proof["leaf_hash"]
        regenerated = merkle.generate_proof(tree, proof["index"])
        assert [{"position": s.position, "hash": s.hash}
                for s in regenerated] == proof["path"]
        path = [merkle.ProofStep(s["position"], s["hash"])
                for s in proof["path"]]
        assert merkle.verify_proof(proof["item"], path, case["root"])


def test_schnorr_vectors(vectors):
    for case in vectors["schnorr"]:
        group = schnorr.GROUPS[case["group"]]
        x = int(case["x"], 16)
        key = schnorr.keygen(group, x=x)
        assert group.to_hex(key.y) == case["y"]
        proof = schnorr.prove(key, case["message"], r=int(case["r"], 16))
        assert group.to_hex(proof.R) == case["R"]
        assert group.to_hex(proof.s) == case["s"]
        c = schnorr.fiat_shamir_challenge(group, proof.y, proof.R,
                                          case["message"])
        assert group.to_hex(c) == case["challenge"]
        assert schnorr.verify(proof)


def test_signature_vector(vectors):
    pytest.importorskip("cryptography")
    from prooflab import signatures
    case = vectors["signature"]
    assert case, "signature vector missing from shared file"
    assert signatures.verify(case["public_key"],
                             case["message"].encode("utf-8"),
                             case["signature"])
