from prooflab import commitments


def test_commit_and_reveal_roundtrip():
    c = commitments.commit("the winner will be team blue")
    assert commitments.verify_reveal(c.commitment, c.secret, c.salt)


def test_wrong_secret_fails():
    c = commitments.commit("17")
    assert not commitments.verify_reveal(c.commitment, "18", c.salt)


def test_wrong_salt_fails():
    c = commitments.commit("17")
    assert not commitments.verify_reveal(c.commitment, "17", "00" * 16)


def test_salts_are_fresh():
    a = commitments.commit("same secret")
    b = commitments.commit("same secret")
    # hiding depends on salt freshness: same secret, different commitments
    assert a.salt != b.salt
    assert a.commitment != b.commitment


def test_encoding_is_exactly_salthex_colon_secret():
    # pinned so the website computes the identical bytes
    got = commitments.compute_commitment("hello", "00112233445566778899aabbccddeeff")
    import hashlib
    expected = hashlib.sha256(
        b"00112233445566778899aabbccddeeff:hello"
    ).hexdigest()
    assert got == expected


def test_verify_tolerates_case_and_whitespace_in_commitment():
    c = commitments.commit("x")
    assert commitments.verify_reveal("  " + c.commitment.upper(), c.secret, c.salt)
