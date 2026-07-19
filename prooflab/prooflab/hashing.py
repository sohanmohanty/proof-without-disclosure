"""SHA-256 hashing of strings and files.

SHA-256 comes from Python's standard library (hashlib); we never implement
the primitive itself, only the ways it is used.
"""

from __future__ import annotations

import hashlib
from pathlib import Path

CHUNK_SIZE = 1 << 20  # 1 MiB: files are streamed, never loaded whole


def sha256_hex(data: bytes) -> str:
    """Hex digest of raw bytes."""
    return hashlib.sha256(data).hexdigest()


def hash_text(text: str) -> str:
    """Hex digest of a UTF-8 string."""
    return sha256_hex(text.encode("utf-8"))


def hash_file(path: str | Path) -> str:
    """Hex digest of a file, read in chunks so large files stay cheap."""
    digest = hashlib.sha256()
    with open(path, "rb") as f:
        while chunk := f.read(CHUNK_SIZE):
            digest.update(chunk)
    return digest.hexdigest()
