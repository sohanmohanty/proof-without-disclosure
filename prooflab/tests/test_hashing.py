"""Hashing tests, anchored to the NIST FIPS 180-2 example vectors."""

from pathlib import Path

from prooflab import hashing

# Published SHA-256 test vectors: if these pass, the hashlib usage here is
# byte-for-byte what every other SHA-256 on earth computes.
NIST_ABC = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
EMPTY = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"


def test_known_vectors():
    assert hashing.hash_text("abc") == NIST_ABC
    assert hashing.hash_text("") == EMPTY


def test_deterministic():
    assert hashing.hash_text("prooflab") == hashing.hash_text("prooflab")


def test_avalanche():
    a = hashing.hash_text("hello")
    b = hashing.hash_text("Hello")
    assert a != b
    # ~half the bits should differ; anything above a third is decisive
    diff_bits = bin(int(a, 16) ^ int(b, 16)).count("1")
    assert diff_bits > 256 // 3


def test_file_hash_matches_text_hash(tmp_path: Path):
    f = tmp_path / "data.txt"
    f.write_bytes("chunked hashing must equal whole hashing".encode())
    assert hashing.hash_file(f) == hashing.hash_text(
        "chunked hashing must equal whole hashing"
    )


def test_file_hash_streams_chunks(tmp_path: Path):
    f = tmp_path / "big.bin"
    data = b"\xab" * (hashing.CHUNK_SIZE * 2 + 12345)  # forces multiple reads
    f.write_bytes(data)
    assert hashing.hash_file(f) == hashing.sha256_hex(data)


def test_modified_file_changes_digest(tmp_path: Path):
    f = tmp_path / "doc.txt"
    f.write_text("version 1")
    before = hashing.hash_file(f)
    f.write_text("version 2")
    assert hashing.hash_file(f) != before
