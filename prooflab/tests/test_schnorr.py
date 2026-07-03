import random

from prooflab import schnorr


def _miller_rabin(n: int, rounds: int = 40) -> bool:
    if n < 2:
        return False
    for small in (2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37):
        if n % small == 0:
            return n == small
    d, r = n - 1, 0
    while d % 2 == 0:
        d //= 2
        r += 1
    rng = random.Random(0xC0FFEE)
    for _ in range(rounds):
        a = rng.randrange(2, n - 1)
        x = pow(a, d, n)
        if x in (1, n - 1):
            continue
        for _ in range(r - 1):
            x = pow(x, 2, n)
            if x == n - 1:
                break
        else:
            return False
    return True


def test_group_parameters_are_sound():
    """Pin the group math: safe primes, and g = 4 generates the order-q
    subgroup. If the RFC 3526 constant were mistyped, this fails."""
    for group in (schnorr.TOY_GROUP, schnorr.REAL_GROUP):
        assert _miller_rabin(group.p), f"{group.name}: p not prime"
        assert _miller_rabin(group.q), f"{group.name}: not a safe prime"
        assert pow(group.g, group.q, group.p) == 1
        assert pow(group.g, 1, group.p) != 1
    assert schnorr.REAL_GROUP.p.bit_length() == 2048


def test_honest_proof_verifies_in_both_groups():
    for group in (schnorr.TOY_GROUP, schnorr.REAL_GROUP):
        key = schnorr.keygen(group)
        proof = schnorr.prove(key, "hello prooflab")
        assert schnorr.verify(proof)


def test_proof_bound_to_message():
    key = schnorr.keygen(schnorr.REAL_GROUP)
    proof = schnorr.prove(key, "pay alice 5")
    tampered = schnorr.Proof(proof.group, proof.y, proof.R, proof.s,
                             "pay mallory 500")
    assert not schnorr.verify(tampered)


def test_wrong_key_fails():
    key = schnorr.keygen(schnorr.REAL_GROUP)
    other = schnorr.keygen(schnorr.REAL_GROUP)
    proof = schnorr.prove(key, "msg")
    forged = schnorr.Proof(proof.group, other.y, proof.R, proof.s, "msg")
    assert not schnorr.verify(forged)


def test_interactive_protocol_honest():
    group = schnorr.TOY_GROUP
    key = schnorr.keygen(group, x=7)
    for _ in range(50):
        r, R = schnorr.commit_nonce(group)
        c = schnorr.random_challenge(group)
        s = schnorr.respond(group, key.x, r, c)
        assert schnorr.check(group, key.y, R, c, s)


def test_cheater_succeeds_at_rate_one_over_q():
    """A prover without x passes only when the challenge matches their guess:
    exactly 1/q. In the toy group (q = 11), 2000 trials should land near
    2000/11 ≈ 182 — this is soundness error made visible."""
    group = schnorr.TOY_GROUP
    key = schnorr.keygen(group, x=7)
    rng = random.Random(42)
    wins = 0
    trials = 2000
    for _ in range(trials):
        guessed_c = rng.randrange(group.q)
        s, R = schnorr.forge_commitment(group, key.y, guessed_c)
        actual_c = rng.randrange(group.q)
        if schnorr.check(group, key.y, R, actual_c, s):
            wins += 1
            assert actual_c == guessed_c  # only possible way to win
    expected = trials / group.q
    assert 0.5 * expected < wins < 1.5 * expected


def test_two_challenges_extract_private_key():
    """The soundness argument, executed: answers to two challenges for the
    same nonce solve for x. (Also why nonce reuse is catastrophic in real
    signature schemes.)"""
    group = schnorr.TOY_GROUP
    key = schnorr.keygen(group, x=9)
    r, R = schnorr.commit_nonce(group, r=5)
    c1, c2 = 3, 8
    s1 = schnorr.respond(group, key.x, r, c1)
    s2 = schnorr.respond(group, key.x, r, c2)
    # x = (s1 - s2) / (c1 - c2) mod q
    extracted = ((s1 - s2) * pow(c1 - c2, -1, group.q)) % group.q
    assert extracted == key.x


def test_simulated_transcripts_verify():
    """The zero-knowledge argument, executed: pick c and s FIRST, derive
    R = g^s * y^(-c) — a valid-looking transcript forged without the key."""
    group = schnorr.REAL_GROUP
    key = schnorr.keygen(group)
    c = 123456789
    s = 987654321
    y_inv_c = pow(key.y, group.q - (c % group.q), group.p)
    R = (pow(group.g, s, group.p) * y_inv_c) % group.p
    assert schnorr.check(group, key.y, R, c, s)


def test_brute_force_cracks_toy_only():
    toy_key = schnorr.keygen(schnorr.TOY_GROUP, x=7)
    assert schnorr.brute_force_dlog(schnorr.TOY_GROUP, toy_key.y) == 7
    real_key = schnorr.keygen(schnorr.REAL_GROUP)
    assert schnorr.brute_force_dlog(schnorr.REAL_GROUP, real_key.y,
                                    limit=10_000) is None
