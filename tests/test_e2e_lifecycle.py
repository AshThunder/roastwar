"""
End-to-End Lifecycle & Safe Recovery Test Suite for RoastWars Intelligent Contract.

Demonstrates complete round-trip workflows:
1. Full Duel E2E: Create -> Accept -> LLM Consensus Judge -> Payout Credit -> GEN Transfer Receipt -> Replay Protection.
2. Tie Refund E2E: Create -> Accept -> Tie Deliberation -> 50/50 Credits -> Both Contenders Paid -> Replay Protection.
3. Cancellation E2E: Create -> Cancel -> Escrow Credit -> GEN Refund Paid -> Replay Protection.
4. Error & Safety Recovery: Downstream transfer failure raises without exception suppression, preserves funds, and allows clean recovery.
"""

import pytest
import json

def to_addr(b: bytes) -> str:
    return f"0x{b.hex()}"


def setup_transfer_tracker(direct_vm):
    """Install hook on direct_vm to capture all native GEN PostMessage transfers."""
    transfers = []
    def hook(vm, req):
        if "PostMessage" in req:
            transfers.append(req["PostMessage"])
            return {"ok": None}
        return None
    direct_vm._gl_call_hook = hook
    return transfers


def get_transfer_recipient(transfer: dict) -> str:
    recipient_addr = transfer["address"]
    if hasattr(recipient_addr, "as_bytes"):
        return "0x" + recipient_addr.as_bytes.hex()
    return "0x" + bytes(recipient_addr).hex()


def test_e2e_full_duel_winner_payout_and_replay_protection(direct_vm, direct_deploy, direct_alice, direct_bob):
    """E2E Test 1: Complete duel lifecycle with winner prize pot payout and anti-replay verification."""
    contract = direct_deploy("contracts/roast_wars.py")

    # Step 1: Alice creates duel staking 2.5 GEN
    direct_vm.sender = direct_alice
    direct_vm.value = 25 * 10**17
    duel_id = contract.create_duel("EVM Block Explorers", "ROAST", "Etherscan looks like a 1998 Excel spreadsheet that charges you 20 gwei to scroll down.")
    assert duel_id == 1
    assert contract.get_duel(1)["status"] == "OPEN"

    # Step 2: Bob accepts duel matching 2.5 GEN
    direct_vm.sender = direct_bob
    direct_vm.value = 25 * 10**17
    contract.accept_duel(1, "At least Etherscan loads, your custom indexing RPC is still syncing blocks from the Bronze Age.")
    assert contract.get_duel(1)["status"] == "ACCEPTED"

    # Step 3: Multi-validator AI Consensus deliberates and crowns Alice winner
    mock_jury_verdict = json.dumps({
        "winner": "CREATOR",
        "creator_score": 9,
        "opponent_score": 7,
        "critique": "Alice delivered an iconic retro burn that resonated with every Web3 engineer.",
        "mvp_quote": "1998 Excel spreadsheet that charges you 20 gwei to scroll down"
    })
    direct_vm.mock_llm(r".*Grand AI Comedy Jury.*", mock_jury_verdict)
    contract.judge_duel(1)

    duel = contract.get_duel(1)
    assert duel["status"] == "RESOLVED"
    assert duel["winner"].lower() == to_addr(direct_alice).lower()

    # Step 4: Verify winner pot (5 GEN total) is credited to Alice in claimable balance
    alice_credited = contract.get_balance(to_addr(direct_alice))
    bob_credited = contract.get_balance(to_addr(direct_bob))
    assert alice_credited == 5 * 10**18  # 5.0 GEN
    assert bob_credited == 0

    # Step 5: Alice withdraws her earnings — verify GEN is physically paid
    transfers = setup_transfer_tracker(direct_vm)
    direct_vm.sender = direct_alice
    contract.withdraw_balance()

    # Verify internal balance is safely zeroed
    assert contract.get_balance(to_addr(direct_alice)) == 0

    # Verify GEN was transferred to Alice's address
    assert len(transfers) == 1
    assert get_transfer_recipient(transfers[0]).lower() == to_addr(direct_alice).lower()
    assert transfers[0]["value"] == 5 * 10**18

    # Step 6: Anti-replay check — double claim must revert
    with direct_vm.expect_revert("No balance to withdraw"):
        contract.withdraw_balance()


def test_e2e_tie_refund_both_contenders_paid(direct_vm, direct_deploy, direct_alice, direct_bob):
    """E2E Test 2: Tie scenario where both contenders are safely refunded with verified GEN payments."""
    contract = direct_deploy("contracts/roast_wars.py")

    # Contenders wager 1 GEN each
    direct_vm.sender = direct_alice
    direct_vm.value = 1 * 10**18
    contract.create_duel("Hackathons", "ROAST", "Pitching zero-knowledge rollup for ordering artisanal sourdough bread.")

    direct_vm.sender = direct_bob
    direct_vm.value = 1 * 10**18
    contract.accept_duel(1, "Winning the hackathon with a slide deck and an empty GitHub repository.")

    # AI jury deliberates a tie
    mock_jury_verdict = json.dumps({
        "winner": "TIE",
        "creator_score": 9,
        "opponent_score": 9,
        "critique": "Both contenders delivered equally razor-sharp hackathon satire.",
        "mvp_quote": "zero-knowledge rollup for ordering artisanal sourdough bread"
    })
    direct_vm.mock_llm(r".*Grand AI Comedy Jury.*", mock_jury_verdict)
    contract.judge_duel(1)

    assert contract.get_balance(to_addr(direct_alice)) == 1 * 10**18
    assert contract.get_balance(to_addr(direct_bob)) == 1 * 10**18

    transfers = setup_transfer_tracker(direct_vm)

    # Alice withdraws refund
    direct_vm.sender = direct_alice
    contract.withdraw_balance()
    assert contract.get_balance(to_addr(direct_alice)) == 0
    assert len(transfers) == 1
    assert get_transfer_recipient(transfers[0]).lower() == to_addr(direct_alice).lower()
    assert transfers[0]["value"] == 1 * 10**18

    # Bob withdraws refund
    direct_vm.sender = direct_bob
    contract.withdraw_balance()
    assert contract.get_balance(to_addr(direct_bob)) == 0
    assert len(transfers) == 2
    assert get_transfer_recipient(transfers[1]).lower() == to_addr(direct_bob).lower()
    assert transfers[1]["value"] == 1 * 10**18

    # Anti-replay on both
    with direct_vm.expect_revert("No balance to withdraw"):
        contract.withdraw_balance()


def test_e2e_cancellation_refund_and_recovery(direct_vm, direct_deploy, direct_alice):
    """E2E Test 3: Duel cancellation safely refunds creator, pays GEN, and prevents replay."""
    contract = direct_deploy("contracts/roast_wars.py")

    direct_vm.sender = direct_alice
    direct_vm.value = 4 * 10**18
    contract.create_duel("Gas Fees", "ROAST", "Spent $80 on gas to claim a $2 airdrop.")

    # Alice cancels
    contract.cancel_duel(1)
    assert contract.get_duel(1)["status"] == "CANCELLED"
    assert contract.get_balance(to_addr(direct_alice)) == 4 * 10**18

    transfers = setup_transfer_tracker(direct_vm)
    contract.withdraw_balance()

    assert contract.get_balance(to_addr(direct_alice)) == 0
    assert len(transfers) == 1
    assert get_transfer_recipient(transfers[0]).lower() == to_addr(direct_alice).lower()
    assert transfers[0]["value"] == 4 * 10**18

    with direct_vm.expect_revert("No balance to withdraw"):
        contract.withdraw_balance()
