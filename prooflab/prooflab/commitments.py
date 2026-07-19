"""Hash-based commitments: commit = SHA-256(salt_hex + ":" + secret).

Properties (both computational, both inherited from SHA-256):
  hiding:  the commitment reveals nothing useful about the secret, because
           the 16-byte random salt blocks brute-force guessing of likely
           secrets;
  binding: opening the commitment to a different secret would require a
           SHA-256 collision.

The exact byte encoding matters for interoperability and is specified in
docs/format-spec.md: UTF-8 of the lowercase hex salt, a ":" separator,
then UTF-8 of the secret.
"""

from __future__ import annotations

import secrets
from dataclasses import dataclass

from .hashing import hash_text

SALT_BYTES = 16


@dataclass(frozen=True)
class Commitment:
    commitment: str  # hex digest, safe to publish
    salt: str        # hex, keep private until reveal
    secret: str      # keep private until reveal


def compute_commitment(secret: str, salt_hex: str) -> str:
    """Deterministic commitment for a given secret and salt."""
    return hash_text(f"{salt_hex}:{secret}")


def commit(secret: str) -> Commitment:
    """Commit to a secret with a fresh random salt."""
    salt_hex = secrets.token_bytes(SALT_BYTES).hex()
    return Commitment(compute_commitment(secret, salt_hex), salt_hex, secret)


def verify_reveal(commitment: str, secret: str, salt_hex: str) -> bool:
    """Check a revealed (secret, salt) pair against a published commitment."""
    return compute_commitment(secret, salt_hex) == commitment.strip().lower()
