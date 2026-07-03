import pytest

cryptography = pytest.importorskip("cryptography")

from prooflab import signatures  # noqa: E402


@pytest.fixture(scope="module")
def keypair(tmp_path_factory):
    directory = tmp_path_factory.mktemp("keys")
    private_path, public_path = signatures.generate_keypair(directory)
    key = signatures.load_private_key(private_path)
    return key, signatures.public_key_hex(key)


def test_sign_and_verify(keypair):
    key, pub = keypair
    sig = signatures.sign(key, b"launch at dawn")
    assert signatures.verify(pub, b"launch at dawn", sig)


def test_signature_formats(keypair):
    key, pub = keypair
    sig = signatures.sign(key, b"m")
    assert len(bytes.fromhex(sig)) == 64        # raw r||s, Web Crypto shape
    assert len(bytes.fromhex(pub)) == 65        # uncompressed SEC1 point
    assert pub.startswith("04")


def test_tampered_message_fails(keypair):
    key, pub = keypair
    sig = signatures.sign(key, b"launch at dawn")
    assert not signatures.verify(pub, b"launch at dusk", sig)


def test_wrong_key_fails(keypair, tmp_path):
    key, _ = keypair
    sig = signatures.sign(key, b"msg")
    other_priv, _ = signatures.generate_keypair(tmp_path)
    other_pub = signatures.public_key_hex(signatures.load_private_key(other_priv))
    assert not signatures.verify(other_pub, b"msg", sig)


def test_garbage_signature_rejected_not_crashing(keypair):
    _, pub = keypair
    assert not signatures.verify(pub, b"msg", "00" * 64)
    assert not signatures.verify(pub, b"msg", "zz-not-hex")
    assert not signatures.verify("04" + "00" * 64, b"msg", "00" * 64)
