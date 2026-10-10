# 🔥 RoastWars — Autonomous On-Chain AI Comedy Arena

![RoastWars Banner](assets/roast_wars_banner.jpg)

> **Where Punchlines Meet Consensus.**  
> An autonomous on-chain comedy & wit duel arena powered by **GenLayer Intelligent Contracts** and decentralized multi-validator AI consensus.

---

## 🏆 Project Overview

**RoastWars** is a decentralized application built on **GenLayer** where comedians, degens, and wordsmiths wager native GEN tokens in 1-on-1 battles of wit.

Traditional blockchains can only process deterministic math. They cannot judge whether a comedy roast was funny, whether a punchline made sense, or whether a comeback was sharper than the opening salvo. GenLayer changes this forever with **Intelligent Contracts** that run LLM prompts directly inside validator consensus.

In RoastWars:
1. **Contenders Create Duels**: Pick a target/topic (e.g., *"Crypto VCs"*, *"AI Startups"*, *"Solana Memecoin Degens"*), choose a format (**🔥 Roast Battle** or **💖 Compliment Duel**), drop an opening punchline, and deposit a wager stake in GEN.
2. **Challengers Accept**: A rival matches the wager and delivers their counter-punchline.
3. **GenLayer AI Jury Deliberates**: The contract summons the decentralized Grand AI Comedy Jury (`gl.vm.run_nondet_unsafe`). Five independent validator nodes prompt leading LLMs with strict comedic rubrics, score both contenders on a 0–10 scale, synthesize a hilarious critique, and vote on the winner.
4. **On-Chain Payout**: Once majority consensus is achieved, the winner takes the entire 2x prize pot, credited programmatically to their internal ledger.

---

## ⛓️ On-Chain Deployment Details (Studio Next)

RoastWars is live and verified on the **GenLayer Studio Next** network:

| Property | Value |
| :--- | :--- |
| **Network** | **GenLayer Studio Next (`studio-dev`)** |
| **Chain ID** | `61997` (`0xf22d`) |
| **RPC Endpoint** | `https://studio-next.genlayer.com/api` |
| **Deployed Contract Address** | [`0x4eA7372915658bdBd94cBB299F4B233913977a88`](https://studio-next.genlayer.com) |
| **Deployment Transaction** | `0x68f399d42588d31f66ecacac48200247f6773e1485b1f378fac96a4940161757` |
| **Deployer Account** | `0x8cbc478963705971f15052e579a8eb4faf7b2211` |
| **GenVM Runner Version** | `py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng` (v0.6) |
| **Consensus Mechanism** | Multi-Validator Equivalence (`gl.vm.run_nondet_unsafe`) |

---

## 🧠 How GenLayer AI Consensus Works in RoastWars

In [`contracts/roast_wars.py`](contracts/roast_wars.py), the `judge_duel` function uses GenLayer's non-deterministic equivalence principle:

```python
@gl.public.write
def judge_duel(self, duel_id: u256) -> None:
    # 1. Fetch battle contenders and format criteria (Roast or Compliment)
    duel = self.duels[duel_id]
    
    # 2. Construct strict Equivalence prompt for GenLayer validator consensus
    prompt = (
        "You are the Grand AI Comedy Jury of RoastWars, an autonomous on-chain comedy club.\n"
        f"TOPIC: \"{duel.topic}\"\n"
        f"FORMAT: {duel.mode} BATTLE\n"
        f"[CONTENDER 1 (Creator)]: \"{duel.creator_punchline}\"\n"
        f"[CONTENDER 2 (Challenger)]: \"{duel.opponent_punchline}\"\n"
        "Respond ONLY with valid JSON: "
        '{"winner": "CREATOR"|"OPPONENT"|"TIE", "creator_score": <int 0-10>, ...}'
    )

    # 3. Leader validator executes LLM prompt via gl.nondet.exec_prompt
    def leader_fn() -> dict:
        raw = gl.nondet.exec_prompt(prompt, response_format="json")
        return _parse_json(raw)

    # 4. Validator nodes independently execute and verify the result matches
    def validator_fn(leaders_res) -> bool:
        vr = leader_fn()
        return vr.get("winner") == leaders_res.calldata.get("winner")

    # 5. On-chain consensus reached through GenVM
    result = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)
    
    # 6. Payout credited to winner's internal escrow ledger
    self._add_balance(winner_address, total_pot)
```

### Key Architectural Highlights
- **Zero Gas & Internal Escrow**: Contenders deposit stakes directly through payable methods. Payouts are credited via internal ledger `_add_balance` (avoiding non-existent `gl.transfer`).
- **Resilient JSON Parsing**: Fault-tolerant extraction with boundary substring parsing (`first "{"` and `last "}"`) to guarantee clean extraction across heterogeneous LLM models.
- **Pinned Runner Header**: Compatible with Studio Next (v0.6) and local testing via `py-genlayer:5jycge4q...`.
- **Equivalence Principle**: Bare `gl.nondet` calls are never invoked at the top level; all non-deterministic logic is isolated inside `run_nondet_unsafe` so validators can deterministically agree.

---

## 🎯 Contract API Reference

### Write Methods (State-Modifying)
- `create_duel(topic: str, mode: str, punchline: str) -> u256` *(payable)*: Creates a new duel with opening punchline and wager.
- `accept_duel(duel_id: u256, punchline: str) -> None` *(payable)*: Matches the required stake and submits the counter-punchline.
- `judge_duel(duel_id: u256) -> None`: Summons the 5-validator AI jury to evaluate both punchlines and crown the winner.
- `cancel_duel(duel_id: u256) -> None`: Allows creator to cancel an open duel and reclaim their stake if no challenger has joined.

### View Methods (Read-Only)
- `get_duel(duel_id: u256) -> dict`: Returns full duel data (contenders, lines, status, scores, critique, MVP quote).
- `get_duels(offset: u256, limit: u256) -> list`: Paginated feed of arena duels.
- `get_duel_count() -> u256`: Total duels initialized in the arena.
- `get_arena_stats() -> dict`: Returns `total_duels`, `total_volume`, and `owner`.
- `get_player_stats(player: Address) -> dict`: Returns player's `wins`, `losses`, `ties`, `total_earned`, and `high_score`.
- `get_balance(account: Address) -> u256`: Returns unwithdrawn winnings in the contract ledger.

---

## 🧪 Testing & Verification

The contract includes a complete suite of in-memory direct mode tests validating all state transitions, boundary conditions, and LLM jury mocking:

```bash
# Run all 8 direct mode tests
pytest tests/test_roast_wars.py -v
```

Output:
```
tests/test_roast_wars.py::test_deploy PASSED
tests/test_roast_wars.py::test_create_roast_duel PASSED
tests/test_roast_wars.py::test_create_invalid_mode_reverts PASSED
tests/test_roast_wars.py::test_accept_duel PASSED
tests/test_roast_wars.py::test_accept_wrong_stake_reverts PASSED
tests/test_roast_wars.py::test_cancel_duel PASSED
tests/test_roast_wars.py::test_judge_duel_creator_wins PASSED
tests/test_roast_wars.py::test_judge_duel_compliment_mode PASSED

============================== 8 passed in 0.29s ===============================
```

### Static Analysis & Linter
```bash
# Validate contract with GenVM Linter
genvm-lint lint contracts/roast_wars.py
```
Output:
```
✓ Lint passed (3 checks)
```

---

## 💻 Frontend & Design System (Tic-Tac-Toe Arena Inspired)

The RoastWars web application features a high-impact **Neo-Brutalist Web3 Gaming Arena** aesthetic directly inspired by the design system of **Tic-Tac-Toe AI Arena** (`tictactoe-genlayer`):

- **Neo-Brutalist Architecture**: Thick 3px/4px solid ink borders (`#1E293B`), sharp corners (`border-radius: 0px`), and hard offset drop shadows (`4px 4px 0px 0px #1E293B`, `6px 6px 0px 0px #1E293B`).
- **Interactive Active States**: Buttons and cards depress with physical feel on hover/press (`transform: translate(2px, 2px)` and shadow shifts to fiery flame `#EA580C`).
- **Space Grotesk Typography**: Punchy, high-contrast, uppercase headlines and buttons in **Space Grotesk** paired with **Inter** body text and **JetBrains Mono** for on-chain addresses and stakes.
- **Live Marquee Ticker**: Continuous animated top banner highlighting arena rules, multi-validator LLM consensus, and prize pots.
- **Arena Battle Cards**: Distinctive battle cards with `BATTLE #ID` header, stakes badges, side-by-side contender boxes, and winner crown highlights.
- **Interactive AI Jury Chamber**: Live 5-validator consensus visualization (`gl.vm.run_nondet_unsafe`), visual score gauges, AI critique reveal, and winner crowning.

```bash
# Start a local web server in the app directory
cd app
python3 -m http.server 3033
```

Open your browser at `http://localhost:3033`:
- **Browse Battle Lobby**: Filter open challenges, accepted battles, and resolved duels.
- **Create Duel**: Set a target topic, format (Roast 🔥 or Compliment 💖), and enter your opening punchline.
- **Accept Challenge**: View creator's burn, write your counter-punchline, and match stake.
- **AI Jury Chamber**: Watch live 5-validator consensus animation, visual score gauges, AI critique reveal, and winner crowning.
- **Leaderboard**: Track top comedians by wins, win rate, high score, and GEN prize volume.

---

## 📁 Repository Structure

```
roast-wars/
├── assets/
│   └── roast_wars_banner.jpg      # Official project banner & visual assets
├── app/
│   ├── index.html                 # Arena web application layout
│   ├── style.css                  # Neo-Brutalist gaming arena design system
│   └── app.js                     # Interactive controller & contract client
├── contracts/
│   └── roast_wars.py              # GenLayer Intelligent Contract (v0.6 runner)
├── tests/
│   └── test_roast_wars.py         # 8/8 passing direct in-memory tests
├── scripts/
│   └── deploy_studionext.mjs      # Deployment script for Studio Next
├── deployed_address.json          # Verified on-chain deployment metadata
└── README.md                      # Complete project documentation
```

---

## 📜 License

MIT License. Built with ❤️ for the GenLayer Developer Ecosystem.
