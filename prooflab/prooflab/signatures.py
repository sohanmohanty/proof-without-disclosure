"""ECDSA P-256 signatures via the `cryptography` library.

Following the project's dividing line: educational protocols (commitments,
Merkle trees, Schnorr) are implemented from scratch for clarity, but real
signing uses a vetted library. Nothing here rolls its own curve arithmetic.

Interop formats (shared with the website's Web Crypto implementation, see
docs/format-spec.md):
  public key: 65-byte uncompressed SEC1 point (0x04 || X || Y), hex;
  signature:  64-byte IEEE P1363 raw form (r || s, 32 bytes each), hex.
Web Crypto emits exactly these; `cryptography` uses DER, so we convert.
"""

from __future__ import annotations

from pathlib import Path

try:
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import ec, utils
    from cryptography.exceptions import InvalidSignature
    HAVE_CRYPTOGRAPHY = True
except ImportError:  # pragma: no cover
    HAVE_CRYPTOGRAPHY = False

ALGORITHM = "ecdsa-p256-sha256"
COORD_BYTES = 32


def _require_cryptography() -> None:
    if not HAVE_CRYPTOGRAPHY:
        raise RuntimeError(
            "signatures require the 'cryptography' package: "
            "pip install prooflab[signatures]"
        )


def generate_keypair(directory: str | Path) -> tuple[Path, Path]:
    """Write private.pem / public.pem into `directory`, return their paths."""
    _require_cryptography()
    directory = Path(directory)
    directory.mkdir(parents=True, exist_ok=True)
    private_key = ec.generate_private_key(ec.SECP256R1())
    private_path = directory / "private.pem"
    public_path = directory / "public.pem"
    private_path.write_bytes(
        private_key.private_bytes(
            serialization.Encoding.PEM,
            serialization.PrivateFormat.PKCS8,
            serialization.NoEncryption(),
        )
    )
    public_path.write_bytes(
        private_key.public_key().public_bytes(
            serialization.Encoding.PEM,
            serialization.PublicFormat.SubjectPublicKeyInfo,
        )
    )
    return private_path, public_path


def load_private_key(path: str | Path):
    _require_cryptography()
    return serialization.load_pem_private_key(Path(path).read_bytes(), None)


def public_key_hex(private_key) -> str:
    """Uncompressed SEC1 point of the matching public key, hex."""
    return private_key.public_key().public_bytes(
        serialization.Encoding.X962,
        serialization.PublicFormat.UncompressedPoint,
    ).hex()


def sign(private_key, message: bytes) -> str:
    """Sign message bytes; return 64-byte r||s hex (Web Crypto compatible)."""
    der = private_key.sign(message, ec.ECDSA(hashes.SHA256()))
    r, s = utils.decode_dss_signature(der)
    return (r.to_bytes(COORD_BYTES, "big") + s.to_bytes(COORD_BYTES, "big")).hex()


def verify(public_key_hex_str: str, message: bytes, signature_hex: str) -> bool:
    """Verify an r||s hex signature against an uncompressed-point hex key."""
    _require_cryptography()
    try:
        point = bytes.fromhex(public_key_hex_str.strip())
        public_key = ec.EllipticCurvePublicKey.from_encoded_point(
            ec.SECP256R1(), point
        )
        raw = bytes.fromhex(signature_hex.strip())
        if len(raw) != 2 * COORD_BYTES:
            return False
        r = int.from_bytes(raw[:COORD_BYTES], "big")
        s = int.from_bytes(raw[COORD_BYTES:], "big")
        der = utils.encode_dss_signature(r, s)
        public_key.verify(der, message, ec.ECDSA(hashes.SHA256()))
        return True
    except (ValueError, InvalidSignature):
        return False
