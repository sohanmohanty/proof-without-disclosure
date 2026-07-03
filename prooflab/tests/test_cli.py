"""End-to-end CLI tests: every workflow a user would actually run."""

import json
from pathlib import Path

import pytest

from prooflab.cli import main


@pytest.fixture(autouse=True)
def workdir(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    return tmp_path


def test_hash_and_verify_roundtrip(workdir: Path, capsys):
    f = workdir / "doc.txt"
    f.write_text("important contents")
    assert main(["hash", str(f), "--out", "doc.hash.json"]) == 0
    assert main(["hash", str(f), "--verify", "doc.hash.json"]) == 0
    f.write_text("tampered contents")
    assert main(["hash", str(f), "--verify", "doc.hash.json"]) == 1


def test_hash_verify_mixed_case_filename(workdir: Path):
    # regression: --verify used to lowercase its argument before treating it
    # as a path, breaking case-sensitive filesystems (Linux/macOS)
    f = workdir / "doc.txt"
    f.write_text("contents")
    assert main(["hash", str(f), "--out", "Doc.Hash.JSON"]) == 0
    assert main(["hash", str(f), "--verify", "Doc.Hash.JSON"]) == 0


def test_hash_verify_uppercase_digest(workdir: Path):
    from prooflab import hashing
    f = workdir / "doc.txt"
    f.write_text("contents")
    assert main(["hash", str(f), "--verify", hashing.hash_file(f).upper()]) == 0


def test_merkle_prove_requires_item_or_index(workdir: Path):
    listing = workdir / "items.txt"
    listing.write_text("a\nb\nc")
    with pytest.raises(SystemExit):
        main(["merkle", "prove", str(listing)])


def test_merkle_prove_index_out_of_range_is_clean_error(workdir: Path, capsys):
    listing = workdir / "items.txt"
    listing.write_text("a\nb\nc")
    assert main(["merkle", "prove", str(listing), "--index", "99"]) == 2
    assert "error:" in capsys.readouterr().err


def test_commit_reveal_roundtrip(workdir: Path):
    assert main(["commit", "team blue wins"]) == 0
    assert main(["reveal", "--commitment", "commitment.json",
                 "--reveal", "reveal.json"]) == 0


def test_reveal_rejects_changed_secret(workdir: Path):
    main(["commit", "team blue wins"])
    reveal = json.loads(Path("reveal.json").read_text())
    assert main(["reveal", "--commitment", "commitment.json",
                 "--secret", "team red wins", "--salt", reveal["salt"]]) == 1


def test_merkle_workflow(workdir: Path):
    listing = workdir / "students.txt"
    listing.write_text("\n".join(f"student_{i}" for i in range(7)))
    assert main(["merkle", "build", str(listing), "--out", "tree.json"]) == 0
    assert main(["merkle", "prove", str(listing), "--item", "student_4",
                 "--out", "proof.json"]) == 0
    assert main(["merkle", "verify", "--proof", "proof.json"]) == 0
    # verifying a different item against the same proof must fail
    assert main(["merkle", "verify", "--proof", "proof.json",
                 "--item", "student_5"]) == 1
    # tampering with the proof file must fail
    doc = json.loads(Path("proof.json").read_text())
    doc["path"][0]["hash"] = "00" * 32
    Path("proof.json").write_text(json.dumps(doc))
    assert main(["merkle", "verify", "--proof", "proof.json"]) == 1


def test_signature_workflow(workdir: Path):
    pytest.importorskip("cryptography")
    msg = workdir / "message.txt"
    msg.write_text("meet at noon")
    assert main(["keygen", "--dir", "keys"]) == 0
    assert main(["sign", str(msg), "--key", "keys/private.pem",
                 "--out", "sig.json"]) == 0
    assert main(["verify-sig", str(msg), "--signature", "sig.json"]) == 0
    msg.write_text("meet at midnight")
    assert main(["verify-sig", str(msg), "--signature", "sig.json"]) == 1


def test_schnorr_workflow(workdir: Path):
    assert main(["schnorr", "keygen", "--out", "key.json"]) == 0
    assert main(["schnorr", "prove", "--key", "key.json",
                 "--message", "it is me", "--out", "proof.json"]) == 0
    assert main(["schnorr", "verify", "--proof", "proof.json"]) == 0
    # tamper with the message: Fiat-Shamir challenge changes, proof dies
    doc = json.loads(Path("proof.json").read_text())
    doc["message"] = "it is mallory"
    Path("proof.json").write_text(json.dumps(doc))
    assert main(["schnorr", "verify", "--proof", "proof.json"]) == 1


def test_schnorr_crack_toy_recovers_key(workdir: Path, capsys):
    main(["schnorr", "keygen", "--toy", "--out", "key.json"])
    capsys.readouterr()
    assert main(["schnorr", "crack", "key.json"]) == 0
    out = capsys.readouterr().out
    assert "private key recovered" in out


def test_zk_color_demo(workdir: Path, capsys):
    assert main(["zk-color", "demo", "--rounds", "30", "--seed", "1"]) == 0
    out = capsys.readouterr().out
    assert "accepted 30/30" in out
    assert main(["zk-color", "demo", "--rounds", "300", "--seed", "7",
                 "--cheat"]) == 0
    out = capsys.readouterr().out
    assert "caught" in out
