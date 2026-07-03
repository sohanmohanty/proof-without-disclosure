"""Merkle trees with RFC 6962-style domain separation.

Two deliberate design choices, both of which close real attacks:

1. Domain separation. Leaves are hashed as SHA-256(0x00 || item) and internal
   nodes as SHA-256(0x01 || left || right). Without distinct prefixes, the
   64-byte concatenation of two child hashes could be presented as a "leaf",
   letting an attacker prove inclusion of items that were never in the list
   (a second-preimage attack on the tree structure). RFC 6962 (Certificate
   Transparency) uses exactly this fix.

2. Odd nodes are promoted, not duplicated. When a level has an odd number of
   nodes, the last node is carried up unchanged. Bitcoin instead duplicates
   the last hash, which makes two different lists (one with a duplicated
   final transaction) produce the same root — the ambiguity behind
   CVE-2012-2459. Promotion keeps the list→root mapping injective.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass

LEAF_PREFIX = b"\x00"
NODE_PREFIX = b"\x01"


def hash_leaf(item: str) -> bytes:
    return hashlib.sha256(LEAF_PREFIX + item.encode("utf-8")).digest()


def hash_node(left: bytes, right: bytes) -> bytes:
    return hashlib.sha256(NODE_PREFIX + left + right).digest()


@dataclass(frozen=True)
class ProofStep:
    position: str  # "left" or "right": which side the sibling sits on
    hash: str      # sibling hash, hex


@dataclass(frozen=True)
class MerkleTree:
    items: list[str]
    levels: list[list[bytes]]  # levels[0] = leaves, levels[-1] = [root]

    @property
    def root(self) -> str:
        return self.levels[-1][0].hex()

    @property
    def leaf_count(self) -> int:
        return len(self.levels[0])


def build_tree(items: list[str]) -> MerkleTree:
    if not items:
        raise ValueError("cannot build a Merkle tree from an empty list")
    levels = [[hash_leaf(item) for item in items]]
    while len(levels[-1]) > 1:
        current = levels[-1]
        parents = []
        for i in range(0, len(current) - 1, 2):
            parents.append(hash_node(current[i], current[i + 1]))
        if len(current) % 2 == 1:
            parents.append(current[-1])  # promote the odd node unchanged
        levels.append(parents)
    return MerkleTree(list(items), levels)


def generate_proof(tree: MerkleTree, index: int) -> list[ProofStep]:
    """Sibling path from leaf `index` to the root.

    A promoted node has no sibling at that level, so no step is recorded —
    verification simply carries the running hash upward, mirroring build.
    """
    if not 0 <= index < tree.leaf_count:
        raise IndexError(f"leaf index {index} out of range")
    path = []
    for level in tree.levels[:-1]:
        sibling = index ^ 1
        if sibling < len(level):
            position = "left" if sibling < index else "right"
            path.append(ProofStep(position, level[sibling].hex()))
        index //= 2
    return path


def verify_proof(item: str, path: list[ProofStep], root: str) -> bool:
    current = hash_leaf(item)
    for step in path:
        sibling = bytes.fromhex(step.hash)
        if step.position == "left":
            current = hash_node(sibling, current)
        elif step.position == "right":
            current = hash_node(current, sibling)
        else:
            raise ValueError(f"invalid proof position: {step.position!r}")
    return current.hex() == root.strip().lower()
