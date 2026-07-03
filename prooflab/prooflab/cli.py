"""prooflab command-line interface.

Commands mirror the website's modules; files produced here verify there and
vice versa. Run `prooflab <command> -h` for any command's options.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from . import __version__
from . import commitments, formats, hashing, merkle, schnorr, zk_graph

OK = "[ok]"
FAIL = "[FAIL]"


def _read_items(path: Path) -> list[str]:
    """One item per non-empty line (works for plain lists and 1-column CSVs)."""
    items = [line.strip() for line in path.read_text(encoding="utf-8").splitlines()]
    items = [item for item in items if item]
    if not items:
        raise SystemExit(f"error: {path} contains no items")
    return items


def _saved(path: Path) -> None:
    print(f"  saved -> {path}")


# --------------------------------------------------------------- hash ---

def cmd_hash(args: argparse.Namespace) -> int:
    digest = hashing.hash_file(args.file)
    print(f"sha256({args.file.name}) = {digest}")
    if args.verify:
        # treat the argument as a path first (case preserved for Linux/macOS),
        # and only lowercase when comparing digests
        raw = args.verify.strip()
        if Path(raw).exists() or raw.lower().endswith(".json"):
            expected = formats.load_doc(raw, "file_hash")["digest"].lower()
        else:
            expected = raw.lower()
        if digest == expected:
            print(f"{OK} digest matches -- file is unchanged")
            return 0
        print(f"{FAIL} digest mismatch -- file differs from the recorded one")
        return 1
    if args.out:
        _saved(formats.write_doc(formats.file_hash_doc(args.file.name, digest),
                                 args.out))
    return 0


# --------------------------------------------------- commit / reveal ---

def cmd_commit(args: argparse.Namespace) -> int:
    c = commitments.commit(args.secret)
    print(f"commitment = {c.commitment}")
    print(f"salt       = {c.salt}  (keep private until you reveal)")
    out_c = args.out or Path("commitment.json")
    out_r = args.out_reveal or Path("reveal.json")
    _saved(formats.write_doc(formats.commitment_doc(c.commitment), out_c))
    _saved(formats.write_doc(formats.reveal_doc(c.secret, c.salt), out_r))
    print("share commitment.json now; keep reveal.json secret until reveal time")
    return 0


def cmd_reveal(args: argparse.Namespace) -> int:
    commitment = formats.load_doc(args.commitment, "commitment")["commitment"]
    if args.reveal:
        reveal = formats.load_doc(args.reveal, "commitment_reveal")
        secret, salt = reveal["secret"], reveal["salt"]
    elif args.secret is not None and args.salt:
        secret, salt = args.secret, args.salt
    else:
        raise SystemExit("error: provide --reveal FILE, or --secret and --salt")
    if commitments.verify_reveal(commitment, secret, salt):
        print(f"{OK} reveal matches the commitment")
        print(f'  the committer locked in "{secret}" and did not change it')
        return 0
    print(f"{FAIL} reveal does NOT match the commitment")
    print("  wrong secret, wrong salt, or the committer is cheating")
    return 1


# ------------------------------------------------------------- merkle ---

def cmd_merkle_build(args: argparse.Namespace) -> int:
    tree = merkle.build_tree(_read_items(args.input))
    print(f"items       = {tree.leaf_count}")
    print(f"tree levels = {len(tree.levels)}")
    print(f"merkle root = {tree.root}")
    if args.out:
        levels_hex = [[h.hex() for h in level] for level in tree.levels]
        _saved(formats.write_doc(
            formats.merkle_tree_doc(tree.root, tree.leaf_count, levels_hex),
            args.out))
    return 0


def cmd_merkle_prove(args: argparse.Namespace) -> int:
    items = _read_items(args.input)
    if args.item is None and args.index is None:
        raise SystemExit("error: provide --item or --index")
    if args.index is not None:
        index = args.index
    else:
        try:
            index = items.index(args.item)
        except ValueError:
            raise SystemExit(f"error: item not found in {args.input}")
    tree = merkle.build_tree(items)
    path = merkle.generate_proof(tree, index)
    item = items[index]
    print(f"item        = {item}")
    print(f"leaf index  = {index}")
    print(f"proof steps = {len(path)}  (vs {tree.leaf_count} items in the set)")
    print(f"merkle root = {tree.root}")
    out = args.out or Path("proof.json")
    _saved(formats.write_doc(
        formats.merkle_proof_doc(item, merkle.hash_leaf(item).hex(),
                                 tree.root, path),
        out))
    return 0


def cmd_merkle_verify(args: argparse.Namespace) -> int:
    doc = formats.load_doc(args.proof, "merkle_proof")
    item = args.item if args.item is not None else doc["item"]
    root = (args.root or doc["root"]).strip().lower()
    path = [merkle.ProofStep(s["position"], s["hash"]) for s in doc["path"]]
    if merkle.verify_proof(item, path, root):
        print(f"{OK} proof valid")
        print(f'  "{item}" is in the set committed to by root {root[:16]}...')
        return 0
    print(f"{FAIL} proof INVALID")
    print("  the item is not in the set, or the proof/root was tampered with")
    return 1


# --------------------------------------------------------- signatures ---

def cmd_keygen(args: argparse.Namespace) -> int:
    from . import signatures
    private_path, public_path = signatures.generate_keypair(args.dir)
    print("generated ECDSA P-256 key pair")
    _saved(private_path)
    _saved(public_path)
    print("keep private.pem secret; share public.pem freely")
    return 0


def cmd_sign(args: argparse.Namespace) -> int:
    from . import signatures
    key = signatures.load_private_key(args.key)
    message = args.file.read_bytes()
    sig = signatures.sign(key, message)
    pub = signatures.public_key_hex(key)
    print(f"signed {args.file.name} ({len(message)} bytes)")
    print(f"signature = {sig[:32]}...")
    out = args.out or Path("signature.json")
    _saved(formats.write_doc(formats.signature_doc(args.file.name, pub, sig),
                             out))
    return 0


def cmd_verify_sig(args: argparse.Namespace) -> int:
    from . import signatures
    doc = formats.load_doc(args.signature, "signature")
    message = args.file.read_bytes()
    if signatures.verify(doc["public_key"], message, doc["signature"]):
        print(f"{OK} signature valid")
        print("  the message is unmodified and was signed by that key")
        return 0
    print(f"{FAIL} signature INVALID")
    print("  the message changed, or was not signed by this public key")
    return 1


# ------------------------------------------------------------ schnorr ---

def _group(args: argparse.Namespace) -> schnorr.Group:
    return schnorr.TOY_GROUP if args.toy else schnorr.REAL_GROUP


def cmd_schnorr_keygen(args: argparse.Namespace) -> int:
    group = _group(args)
    key = schnorr.keygen(group)
    print(f"group       = {group.name}  (p is {group.p.bit_length()} bits)")
    print(f"private x   = {'<hidden>' if not args.toy else key.x}")
    print(f"public  y   = g^x mod p = {group.to_hex(key.y)[:32]}...")
    out = args.out or Path("schnorr_key.json")
    _saved(formats.write_doc(
        formats.schnorr_key_doc(group.name, group.to_hex(key.x),
                                group.to_hex(key.y)),
        out))
    print("schnorr_key.json holds the PRIVATE key -- do not share it")
    return 0


def cmd_schnorr_prove(args: argparse.Namespace) -> int:
    doc = formats.load_doc(args.key, "schnorr_keypair")
    group = schnorr.GROUPS[doc["group"]]
    key = schnorr.keygen(group, x=int(doc["private_key"], 16))
    proof = schnorr.prove(key, args.message)
    c = schnorr.fiat_shamir_challenge(group, proof.y, proof.R, proof.message)
    print(f"group      = {group.name}")
    print(f"message    = {args.message!r}")
    print(f"commitment R = g^r        = {group.to_hex(proof.R)[:32]}...")
    print(f"challenge  c = H(y|R|msg) = {hex(c)[:34]}...   (Fiat-Shamir)")
    print(f"response   s = r + c*x    = {group.to_hex(proof.s)[:32]}...")
    out = args.out or Path("schnorr_proof.json")
    _saved(formats.write_doc(
        formats.schnorr_proof_doc(group.name, group.to_hex(proof.y),
                                  group.to_hex(proof.R), group.to_hex(proof.s),
                                  proof.message),
        out))
    return 0


def cmd_schnorr_verify(args: argparse.Namespace) -> int:
    doc = formats.load_doc(args.proof, "schnorr_proof")
    group = schnorr.GROUPS[doc["group"]]
    proof = schnorr.Proof(group, int(doc["public_key"], 16),
                          int(doc["commitment"], 16), int(doc["response"], 16),
                          doc["message"])
    if schnorr.verify(proof):
        print(f"{OK} proof valid")
        print("  the prover knows the private key for this public key,")
        print("  and the proof is bound to message " + repr(proof.message))
        return 0
    print(f"{FAIL} proof INVALID")
    return 1


def cmd_schnorr_crack(args: argparse.Namespace) -> int:
    doc = formats.load_doc(args.key_or_proof)
    group = schnorr.GROUPS[doc["group"]]
    y = int(doc["public_key"], 16)
    print(f"brute-forcing discrete log of y in {group.name} "
          f"(q ~ 2^{group.q.bit_length() - 1})...")
    x = schnorr.brute_force_dlog(group, y)
    if x is not None:
        print(f"{FAIL} private key recovered: x = {x}")
        print("  toy groups are for learning; security needs ~2048-bit groups")
        return 0
    print(f"{OK} gave up -- the group is far too large to brute-force")
    print(f"  checking 10^9 exponents/second would take ~10^{len(str(group.q)) - 10} years")
    return 0


# ----------------------------------------------------------- zk-color ---

def cmd_zk_color(args: argparse.Namespace) -> int:
    graph = zk_graph.PETERSEN
    coloring = zk_graph.PETERSEN_CHEAT_COLORING if args.cheat else graph.coloring
    label = "CHEATING prover (one bad edge)" if args.cheat else "honest prover"
    print(f"graph: Petersen -- {graph.nodes} nodes, {len(graph.edges)} edges")
    print(f"role:  {label}\n")
    transcript = zk_graph.simulate(graph, coloring, args.rounds, args.seed)
    if args.stop_when_caught and transcript.caught:
        # truncate at the first rejection so the summary matches what's shown
        first_reject = next(i for i, r in enumerate(transcript.rounds)
                            if not r.accepted)
        transcript.rounds = transcript.rounds[:first_reject + 1]
    for i, rnd in enumerate(transcript.rounds, 1):
        u, v = rnd.challenged_edge
        cu, cv = rnd.colors_shown
        verdict = "accept" if rnd.accepted else "REJECT -- caught!"
        print(f"  round {i:>3}: edge ({u},{v}) opened -> colors ({cu},{cv})  {verdict}")
        if not rnd.accepted and args.stop_when_caught:
            break
    print(f"\naccepted {transcript.accepted_rounds}/{len(transcript.rounds)} rounds")
    bound = transcript.cheat_survival_bound()
    print(f"a prover with >=1 bad edge survives {len(transcript.rounds)} rounds "
          f"with probability <= {bound:.4f}")
    if transcript.caught:
        print("the cheater was caught -- soundness in action")
    elif args.cheat:
        print("the cheater survived this time -- run more rounds!")
    else:
        print("every round passed, yet the verifier never saw the coloring --")
        print("zero-knowledge in action")
    return 0


# ---------------------------------------------------------------- main ---

def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="prooflab",
        description="Educational cryptography toolkit: prove, verify, and "
                    "trust without unnecessary disclosure.",
        epilog="Educational use only -- not audited, not production security.",
    )
    parser.add_argument("--version", action="version",
                        version=f"prooflab {__version__}")
    sub = parser.add_subparsers(dest="command", required=True)

    p = sub.add_parser("hash", help="hash a file (SHA-256), or verify one")
    p.add_argument("file", type=Path)
    p.add_argument("--out", type=Path, help="save digest as a JSON record")
    p.add_argument("--verify", metavar="DIGEST_OR_JSON",
                   help="compare against a hex digest or saved record")
    p.set_defaults(func=cmd_hash)

    p = sub.add_parser("commit", help="commit to a secret without revealing it")
    p.add_argument("secret")
    p.add_argument("--out", type=Path, help="commitment file (public)")
    p.add_argument("--out-reveal", type=Path, help="reveal file (private)")
    p.set_defaults(func=cmd_commit)

    p = sub.add_parser("reveal", help="verify a revealed secret against a commitment")
    p.add_argument("--commitment", type=Path, required=True)
    p.add_argument("--reveal", type=Path, help="reveal JSON from `commit`")
    p.add_argument("--secret", help="...or pass the secret directly")
    p.add_argument("--salt", help="...with its salt")
    p.set_defaults(func=cmd_reveal)

    p = sub.add_parser("merkle", help="build trees, prove and verify membership")
    msub = p.add_subparsers(dest="merkle_command", required=True)

    m = msub.add_parser("build", help="build a Merkle tree from a list file")
    m.add_argument("input", type=Path, help="text file, one item per line")
    m.add_argument("--out", type=Path)
    m.set_defaults(func=cmd_merkle_build)

    m = msub.add_parser("prove", help="prove one item is in the list")
    m.add_argument("input", type=Path)
    m.add_argument("--item", help="the item to prove")
    m.add_argument("--index", type=int, help="...or its line index (0-based)")
    m.add_argument("--out", type=Path)
    m.set_defaults(func=cmd_merkle_prove)

    m = msub.add_parser("verify", help="verify a membership proof")
    m.add_argument("--proof", type=Path, required=True)
    m.add_argument("--root", help="expected root (defaults to the proof's)")
    m.add_argument("--item", help="expected item (defaults to the proof's)")
    m.set_defaults(func=cmd_merkle_verify)

    p = sub.add_parser("keygen", help="generate an ECDSA P-256 key pair")
    p.add_argument("--dir", type=Path, default=Path("keys"))
    p.set_defaults(func=cmd_keygen)

    p = sub.add_parser("sign", help="sign a file")
    p.add_argument("file", type=Path)
    p.add_argument("--key", type=Path, required=True, help="private.pem")
    p.add_argument("--out", type=Path)
    p.set_defaults(func=cmd_sign)

    p = sub.add_parser("verify-sig", help="verify a file signature")
    p.add_argument("file", type=Path)
    p.add_argument("--signature", type=Path, required=True)
    p.set_defaults(func=cmd_verify_sig)

    p = sub.add_parser("schnorr", help="zero-knowledge proofs of key knowledge")
    ssub = p.add_subparsers(dest="schnorr_command", required=True)

    s = ssub.add_parser("keygen", help="generate a discrete-log key pair")
    s.add_argument("--toy", action="store_true",
                   help="use the hand-checkable 23-element group")
    s.add_argument("--out", type=Path)
    s.set_defaults(func=cmd_schnorr_keygen)

    s = ssub.add_parser("prove", help="prove knowledge of the private key")
    s.add_argument("--key", type=Path, required=True)
    s.add_argument("--message", default="", help="bind the proof to a message")
    s.add_argument("--out", type=Path)
    s.set_defaults(func=cmd_schnorr_prove)

    s = ssub.add_parser("verify", help="verify a Schnorr proof")
    s.add_argument("--proof", type=Path, required=True)
    s.set_defaults(func=cmd_schnorr_verify)

    s = ssub.add_parser("crack", help="try to brute-force a private key "
                                      "(educational: succeeds only on --toy keys)")
    s.add_argument("key_or_proof", type=Path,
                   help="a schnorr key or proof JSON")
    s.set_defaults(func=cmd_schnorr_crack)

    p = sub.add_parser("zk-color",
                       help="zero-knowledge graph 3-coloring simulation")
    zsub = p.add_subparsers(dest="zk_command", required=True)
    z = zsub.add_parser("demo", help="simulate prover/verifier rounds")
    z.add_argument("--rounds", type=int, default=20)
    z.add_argument("--cheat", action="store_true",
                   help="prover's coloring has one bad edge -- watch soundness work")
    z.add_argument("--seed", type=int, help="seed the verifier's randomness")
    z.add_argument("--stop-when-caught", action="store_true")
    z.set_defaults(func=cmd_zk_color)

    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        return args.func(args)
    except KeyError as exc:
        print(f"error: document is missing field {exc}", file=sys.stderr)
        return 2
    except (ValueError, RuntimeError, FileNotFoundError, IndexError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
