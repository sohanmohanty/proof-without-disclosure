from prooflab import zk_graph


def test_petersen_witness_is_valid():
    assert zk_graph.bad_edges(zk_graph.PETERSEN,
                              zk_graph.PETERSEN.coloring) == []


def test_cheat_coloring_has_exactly_one_bad_edge():
    bad = zk_graph.bad_edges(zk_graph.PETERSEN,
                             zk_graph.PETERSEN_CHEAT_COLORING)
    assert bad == [(3, 4)]


def test_honest_prover_always_accepted():
    transcript = zk_graph.simulate(zk_graph.PETERSEN,
                                   zk_graph.PETERSEN.coloring,
                                   rounds=200, seed=1)
    assert transcript.accepted_rounds == 200
    assert not transcript.caught


def test_cheater_gets_caught_eventually():
    # One bad edge among 15: catch probability per round is 1/15, so 600
    # rounds leave survival odds around (14/15)^600 ≈ 1e-18.
    transcript = zk_graph.simulate(zk_graph.PETERSEN,
                                   zk_graph.PETERSEN_CHEAT_COLORING,
                                   rounds=600, seed=7)
    assert transcript.caught


def test_cheater_caught_only_on_the_bad_edge():
    transcript = zk_graph.simulate(zk_graph.PETERSEN,
                                   zk_graph.PETERSEN_CHEAT_COLORING,
                                   rounds=600, seed=7)
    for rnd in transcript.rounds:
        if not rnd.accepted:
            assert tuple(sorted(rnd.challenged_edge)) == (3, 4)


def test_survival_bound_math():
    transcript = zk_graph.simulate(zk_graph.PETERSEN,
                                   zk_graph.PETERSEN.coloring,
                                   rounds=100, seed=3)
    assert abs(transcript.cheat_survival_bound() - (14 / 15) ** 100) < 1e-12


def test_rounds_reveal_only_two_colors():
    transcript = zk_graph.simulate(zk_graph.PETERSEN,
                                   zk_graph.PETERSEN.coloring,
                                   rounds=50, seed=5)
    for rnd in transcript.rounds:
        assert len(rnd.colors_shown) == 2
        assert rnd.openings_valid
        assert rnd.colors_differ
