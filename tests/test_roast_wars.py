import pytest
import json

def to_addr(b: bytes) -> str:
    return f"0x{b.hex()}"


def test_deploy(direct_deploy):
    """RoastWars deploys cleanly and initializes empty state."""
    contract = direct_deploy("contracts/roast_wars.py")
    assert contract is not None
    assert contract.get_duel_count() == 0
    stats = contract.get_arena_stats()
    assert stats["total_duels"] == 0
    assert stats["total_volume"] == 0


def test_create_roast_duel(direct_vm, direct_deploy, direct_alice):
    """Alice creates a Roast duel with stake."""
    contract = direct_deploy("contracts/roast_wars.py")
    direct_vm.sender = direct_alice
    direct_vm.value = 5 * 10**18

    duel_id = contract.create_duel("Crypto VCs", "ROAST", "You guys invest in 100 pitch decks and 99 of them are just ChatGPT wrappers with a token.")
    assert duel_id == 1
    assert contract.get_duel_count() == 1

    duel = contract.get_duel(1)
    assert duel["id"] == 1
    assert duel["topic"] == "Crypto VCs"
    assert duel["mode"] == "ROAST"
    assert duel["status"] == "OPEN"
    assert duel["stake"] == 5 * 10**18
    assert duel["creator"].lower() == to_addr(direct_alice).lower()


def test_create_invalid_mode_reverts(direct_vm, direct_deploy, direct_alice):
    """Creating a duel with invalid mode reverts."""
    contract = direct_deploy("contracts/roast_wars.py")
    direct_vm.sender = direct_alice
    direct_vm.value = 1 * 10**18

    with direct_vm.expect_revert("Mode must be either 'ROAST' or 'COMPLIMENT'"):
        contract.create_duel("Web3", "RAP_BATTLE", "My rhymes are too fast.")


def test_accept_duel(direct_vm, direct_deploy, direct_alice, direct_bob):
    """Bob accepts Alice's open duel with matching stake."""
    contract = direct_deploy("contracts/roast_wars.py")

    # Alice creates
    direct_vm.sender = direct_alice
    direct_vm.value = 2 * 10**18
    contract.create_duel("Solana", "ROAST", "Fastest TPS in Web3, as long as you don't count the weekly scheduled nap.")

    # Bob accepts
    direct_vm.sender = direct_bob
    direct_vm.value = 2 * 10**18
    contract.accept_duel(1, "At least Solana wakes up, Ethereum fees put you into a coma before your swap confirms.")

    duel = contract.get_duel(1)
    assert duel["status"] == "ACCEPTED"
    assert duel["opponent"].lower() == to_addr(direct_bob).lower()
    assert "Ethereum fees" in duel["opponent_punchline"]


def test_accept_wrong_stake_reverts(direct_vm, direct_deploy, direct_alice, direct_bob):
    """Accepting with mismatched stake reverts."""
    contract = direct_deploy("contracts/roast_wars.py")

    direct_vm.sender = direct_alice
    direct_vm.value = 5 * 10**18
    contract.create_duel("Python", "ROAST", "Tabs vs spaces is the biggest crisis of your life.")

    direct_vm.sender = direct_bob
    direct_vm.value = 2 * 10**18  # wrong stake

    with direct_vm.expect_revert("Sent value"):
        contract.accept_duel(1, "At least Python is readable without an MIT degree.")


def test_cancel_duel(direct_vm, direct_deploy, direct_alice, direct_bob):
    """Creator can cancel an open duel and get refunded."""
    contract = direct_deploy("contracts/roast_wars.py")

    direct_vm.sender = direct_alice
    direct_vm.value = 3 * 10**18
    contract.create_duel("NFTs", "ROAST", "Congratulations on paying $50,000 for a receipt to a JPEG.")

    # Bob cannot cancel Alice's duel
    direct_vm.sender = direct_bob
    with direct_vm.expect_revert("Only creator or owner can cancel"):
        contract.cancel_duel(1)

    # Alice cancels
    direct_vm.sender = direct_alice
    contract.cancel_duel(1)

    duel = contract.get_duel(1)
    assert duel["status"] == "CANCELLED"


def test_judge_duel_creator_wins(direct_vm, direct_deploy, direct_alice, direct_bob):
    """AI jury consensus awards victory to Creator with critique."""
    contract = direct_deploy("contracts/roast_wars.py")

    direct_vm.sender = direct_alice
    direct_vm.value = 1 * 10**18
    contract.create_duel("AI Startups", "ROAST", "Your pitch deck has 4 slides: Problem, Solution, Team, and 'Powered by GenLayer'.")

    direct_vm.sender = direct_bob
    direct_vm.value = 1 * 10**18
    contract.accept_duel(1, "Your startup is so early your code comments are just thoughts and prayers.")

    # Mock the LLM verdict
    mock_verdict = json.dumps({
        "winner": "CREATOR",
        "creator_score": 9,
        "opponent_score": 7,
        "critique": "Creator delivered a piercing observation on modern AI hype that felt painfully accurate.",
        "mvp_quote": "Problem, Solution, Team, and Powered by GenLayer"
    })

    direct_vm.mock_llm(r".*Grand AI Comedy Jury.*", mock_verdict)
    contract.judge_duel(1)

    duel = contract.get_duel(1)
    assert duel["status"] == "RESOLVED"
    assert duel["winner"].lower() == to_addr(direct_alice).lower()
    assert duel["winning_side"] == "CREATOR"
    assert duel["creator_score"] == 9
    assert duel["opponent_score"] == 7
    assert "piercing observation" in duel["ai_critique"]

    # Check stats
    stats_alice = contract.get_player_stats(to_addr(direct_alice))
    assert stats_alice["wins"] == 1
    assert stats_alice["total_earned"] == 2 * 10**18


def test_judge_duel_compliment_mode(direct_vm, direct_deploy, direct_alice, direct_bob):
    """AI jury evaluates a heartwarming compliment duel."""
    contract = direct_deploy("contracts/roast_wars.py")

    direct_vm.sender = direct_alice
    direct_vm.value = 1 * 10**18
    contract.create_duel("Open Source Devs", "COMPLIMENT", "You build the digital bridges that hold civilization together for zero pay and infinite patience.")

    direct_vm.sender = direct_bob
    direct_vm.value = 1 * 10**18
    contract.accept_duel(1, "Your GitHub commit history is brighter than the constellations at night.")

    mock_verdict = json.dumps({
        "winner": "OPPONENT",
        "creator_score": 8,
        "opponent_score": 10,
        "critique": "Opponent crafted an unforgettable poetic image of starry commits that completely won the jury.",
        "mvp_quote": "brighter than the constellations at night"
    })

    direct_vm.mock_llm(r".*Grand AI Comedy Jury.*", mock_verdict)
    contract.judge_duel(1)

    duel = contract.get_duel(1)
    assert duel["status"] == "RESOLVED"
    assert duel["winner"].lower() == to_addr(direct_bob).lower()
    assert duel["winning_side"] == "OPPONENT"
    assert duel["opponent_score"] == 10


def test_winner_credits_withdraw_no_replay(direct_vm, direct_deploy, direct_alice, direct_bob):
    """Winner can withdraw credited pot, and subsequent withdraw reverts (no replay)."""
    contract = direct_deploy("contracts/roast_wars.py")

    direct_vm.sender = direct_alice
    direct_vm.value = 2 * 10**18
    contract.create_duel("Solana", "ROAST", "Rebooting the network is their favorite consensus algorithm.")

    direct_vm.sender = direct_bob
    direct_vm.value = 2 * 10**18
    contract.accept_duel(1, "At least it reboots faster than Ethereum confirms a sandwich attack.")

    mock_verdict = json.dumps({
        "winner": "CREATOR",
        "creator_score": 9,
        "opponent_score": 6,
        "critique": "Creator punchline was devastating and technically precise.",
        "mvp_quote": "Rebooting the network is their favorite consensus algorithm"
    })
    direct_vm.mock_llm(r".*Grand AI Comedy Jury.*", mock_verdict)
    contract.judge_duel(1)

    # Alice won the 4 GEN pot (credited to internal balance)
    assert contract.get_balance(to_addr(direct_alice)) == 4 * 10**18
    assert contract.get_balance(to_addr(direct_bob)) == 0

    # Alice withdraws her winnings
    direct_vm.sender = direct_alice
    contract.withdraw_balance()

    # Balance is consumed to 0
    assert contract.get_balance(to_addr(direct_alice)) == 0

    # Second withdrawal attempt reverts (preventing replay)
    with direct_vm.expect_revert("No balance to withdraw"):
        contract.withdraw_balance()


def test_tie_credits_withdraw_no_replay(direct_vm, direct_deploy, direct_alice, direct_bob):
    """Both contenders receive refunds on a tie, can withdraw once, and replay is blocked."""
    contract = direct_deploy("contracts/roast_wars.py")

    direct_vm.sender = direct_alice
    direct_vm.value = 15 * 10**17  # 1.5 GEN
    contract.create_duel("Rust", "ROAST", "The borrow checker rejected my marriage proposal.")

    direct_vm.sender = direct_bob
    direct_vm.value = 15 * 10**17  # 1.5 GEN
    contract.accept_duel(1, "The compiler threw a lifetime error when I said till death do us part.")

    mock_verdict = json.dumps({
        "winner": "TIE",
        "creator_score": 8,
        "opponent_score": 8,
        "critique": "Both contenders delivered equally magnificent borrow checker punchlines.",
        "mvp_quote": "lifetime error when I said till death do us part"
    })
    direct_vm.mock_llm(r".*Grand AI Comedy Jury.*", mock_verdict)
    contract.judge_duel(1)

    # Both players credited with their refunded stakes
    assert contract.get_balance(to_addr(direct_alice)) == 15 * 10**17
    assert contract.get_balance(to_addr(direct_bob)) == 15 * 10**17

    # Alice withdraws her refund
    direct_vm.sender = direct_alice
    contract.withdraw_balance()
    assert contract.get_balance(to_addr(direct_alice)) == 0

    # Alice replay attempt reverts
    with direct_vm.expect_revert("No balance to withdraw"):
        contract.withdraw_balance()

    # Bob withdraws his refund
    direct_vm.sender = direct_bob
    contract.withdraw_balance()
    assert contract.get_balance(to_addr(direct_bob)) == 0

    # Bob replay attempt reverts
    with direct_vm.expect_revert("No balance to withdraw"):
        contract.withdraw_balance()


def test_cancellation_credits_withdraw_no_replay(direct_vm, direct_deploy, direct_alice):
    """Creator recovers stake upon cancellation, cancellation cannot be repeated, and withdraw cannot replay."""
    contract = direct_deploy("contracts/roast_wars.py")

    direct_vm.sender = direct_alice
    direct_vm.value = 3 * 10**18
    contract.create_duel("Crypto Influencers", "ROAST", "Your technical analysis is just astrology for finance bros.")

    # Duel is OPEN
    assert contract.get_duel(1)["status"] == "OPEN"
    assert contract.get_balance(to_addr(direct_alice)) == 0

    # Alice cancels the duel
    direct_vm.sender = direct_alice
    contract.cancel_duel(1)

    assert contract.get_duel(1)["status"] == "CANCELLED"
    assert contract.get_balance(to_addr(direct_alice)) == 3 * 10**18

    # Cancellation cannot be replayed on an already cancelled duel
    with direct_vm.expect_revert("Cannot cancel duel in status 'CANCELLED'"):
        contract.cancel_duel(1)

    # Alice withdraws her refunded stake
    contract.withdraw_balance()
    assert contract.get_balance(to_addr(direct_alice)) == 0

    # Replay withdrawal is blocked
    with direct_vm.expect_revert("No balance to withdraw"):
        contract.withdraw_balance()

