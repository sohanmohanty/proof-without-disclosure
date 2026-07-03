"""JSON proof-file formats shared with the website.

Every file prooflab writes carries the same envelope:
    format: "prooflab", version: 1, type: <what kind of object>, note: ...
The website's verifiers accept these files, and website-generated files
verify here — two independent implementations of one spec
(docs/format-spec.md), pinned together by vectors/test-vectors.json.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from . import EDUCATIONAL_NOTE, FORMAT_VERSION
from .merkle import ProofStep


def _envelope(type_: str, **fields: Any) -> dict[str, Any]:
    return {
        "format": "prooflab",
        "version": FORMAT_VERSION,
        "type": type_,
        **fields,
        "created_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "note": EDUCATIONAL_NOTE,
    }


def file_hash_doc(file_name: str, digest: str) -> dict[str, Any]:
    return _envelope("file_hash", hash_function="sha256",
                     file_name=file_name, digest=digest)


def commitment_doc(commitment: str) -> dict[str, Any]:
    return _envelope("commitment", hash_function="sha256",
                     encoding="utf8(salt_hex):utf8(secret)",
                     commitment=commitment)


def reveal_doc(secret: str, salt: str) -> dict[str, Any]:
    return _envelope("commitment_reveal", hash_function="sha256",
                     secret=secret, salt=salt)


def merkle_tree_doc(root: str, leaf_count: int,
                    levels: list[list[str]]) -> dict[str, Any]:
    return _envelope("merkle_tree", hash_function="sha256",
                     domain_separation="rfc6962", odd_rule="promote",
                     root=root, leaf_count=leaf_count, levels=levels)


def merkle_proof_doc(item: str, leaf_hash: str, root: str,
                     path: list[ProofStep]) -> dict[str, Any]:
    return _envelope("merkle_proof", hash_function="sha256",
                     domain_separation="rfc6962", odd_rule="promote",
                     item=item, leaf_hash=leaf_hash, root=root,
                     path=[{"position": s.position, "hash": s.hash}
                           for s in path])


def signature_doc(file_name: str, public_key: str,
                  signature: str) -> dict[str, Any]:
    return _envelope("signature", algorithm="ecdsa-p256-sha256",
                     file_name=file_name, public_key=public_key,
                     signature=signature)


def schnorr_proof_doc(group_name: str, y_hex: str, R_hex: str, s_hex: str,
                      message: str) -> dict[str, Any]:
    return _envelope("schnorr_proof", flavor="fiat-shamir",
                     hash_function="sha256", group=group_name,
                     public_key=y_hex, commitment=R_hex, response=s_hex,
                     message=message)


def schnorr_key_doc(group_name: str, x_hex: str, y_hex: str) -> dict[str, Any]:
    return _envelope("schnorr_keypair", group=group_name,
                     private_key=x_hex, public_key=y_hex)


def write_doc(doc: dict[str, Any], path: str | Path) -> Path:
    path = Path(path)
    path.write_text(json.dumps(doc, indent=2) + "\n", encoding="utf-8")
    return path


def load_doc(path: str | Path, expected_type: str | None = None) -> dict[str, Any]:
    doc = json.loads(Path(path).read_text(encoding="utf-8"))
    if doc.get("format") != "prooflab":
        raise ValueError(f"{path}: not a prooflab file (missing format field)")
    if doc.get("version") != FORMAT_VERSION:
        raise ValueError(f"{path}: unsupported version {doc.get('version')!r}")
    if expected_type and doc.get("type") != expected_type:
        raise ValueError(
            f"{path}: expected type {expected_type!r}, found {doc.get('type')!r}"
        )
    return doc
