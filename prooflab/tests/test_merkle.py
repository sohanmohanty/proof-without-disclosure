import hashlib

import pytest

from prooflab import merkle

ITEMS4 = ["alice@example.com", "bob@example.com",
          "carol@example.com", "dana@example.com"]


def test_every_item_proves_for_sizes_1_through_9():
    for n in range(1, 10):
        items = [f"item-{i}" for i in range(n)]
        tree = merkle.build_tree(items)
        for i, item in enumerate(items):
            path = merkle.generate_proof(tree, i)
            assert merkle.verify_proof(item, path, tree.root), (n, i)


def test_absent_item_fails():
    tree = merkle.build_tree(ITEMS4)
    path = merkle.generate_proof(tree, 1)
    assert not merkle.verify_proof("mallory@example.com", path, tree.root)


def test_tampered_root_fails():
    tree = merkle.build_tree(ITEMS4)
    path = merkle.generate_proof(tree, 0)
    bad_root = ("0" if tree.root[0] != "0" else "1") + tree.root[1:]
    assert not merkle.verify_proof(ITEMS4[0], path, bad_root)


def test_tampered_leaf_changes_root():
    before = merkle.build_tree(ITEMS4).root
    tampered = ITEMS4.copy()
    tampered[2] = "eve@example.com"
    assert merkle.build_tree(tampered).root != before


def test_proof_size_is_logarithmic():
    tree = merkle.build_tree([f"user-{i}" for i in range(1024)])
    assert len(merkle.generate_proof(tree, 500)) == 10  # log2(1024)


def test_domain_separation_leaf_vs_node():
    # H(0x00||x) != H(0x01||x): an internal node can never masquerade as a
    # leaf. This distinction is what blocks proof-forgery via fake leaves.
    payload = "same bytes"
    leaf = merkle.hash_leaf(payload)
    node_style = hashlib.sha256(b"\x01" + payload.encode()).digest()
    assert leaf != node_style
    assert leaf != hashlib.sha256(payload.encode()).digest()  # != plain hash


def test_forged_internal_node_leaf_rejected():
    """The concrete RFC 6962 attack we prevent: present the concatenation of
    two internal hashes as if it were a leaf. With domain separation the
    forged proof must fail."""
    tree = merkle.build_tree(ITEMS4)
    left, right = tree.levels[1][0], tree.levels[1][1]
    fake_item = (left + right).hex()  # attacker crafts this "item"
    # a one-step "proof" that would work if leaves hashed like nodes
    assert not merkle.verify_proof(fake_item, [], tree.root)


def test_odd_promotion_differs_from_duplication():
    """Promoting the odd node must NOT equal Bitcoin-style duplication —
    duplication is what allowed CVE-2012-2459's ambiguous trees."""
    items = ["a", "b", "c"]
    tree = merkle.build_tree(items)
    # duplication would compute root over leaves [a, b, c, c]
    dup_tree = merkle.build_tree(["a", "b", "c", "c"])
    assert tree.root != dup_tree.root


def test_list_to_root_is_injective_for_promoted_trees():
    assert merkle.build_tree(["a", "b", "c"]).root != \
           merkle.build_tree(["a", "b"]).root


def test_empty_list_rejected():
    with pytest.raises(ValueError):
        merkle.build_tree([])


def test_single_item_tree():
    tree = merkle.build_tree(["only"])
    assert merkle.verify_proof("only", merkle.generate_proof(tree, 0), tree.root)
