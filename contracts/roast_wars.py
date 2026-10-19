# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

import genlayer as gl
from genlayer import *
try:
    from genlayer.storage import TreeMap, allow as allow_storage
except (ImportError, AttributeError):
    pass

if "allow_storage" not in globals():
    try:
        allow_storage = gl.storage.allow
    except AttributeError:
        pass

if "TreeMap" not in globals():
    try:
        TreeMap = gl.storage.TreeMap
    except AttributeError:
        pass

from dataclasses import dataclass
import json

# Error classifications
ERROR_EXPECTED  = "[EXPECTED]"
ERROR_LLM       = "[LLM_ERROR]"
ERROR_TRANSIENT = "[TRANSIENT]"


def _parse_json(text: str) -> dict:
    if isinstance(text, dict):
        return text
    if not isinstance(text, str):
        return dict(text)
    first = text.find("{")
    last = text.rfind("}")
    if first == -1 or last == -1:
        raise ValueError(f"No JSON object found in text: {text}")
    return json.loads(text[first:last + 1])


@allow_storage
@dataclass
class Duel:
    id: u256
    creator: Address
    opponent: Address
    topic: str
    mode: str                  # "ROAST" or "COMPLIMENT"
    stake: u256                # Wagered stake per player (in wei)
    status: str               # "OPEN", "ACCEPTED", "RESOLVED", "CANCELLED"
    creator_punchline: str
    opponent_punchline: str
    winner: Address           # Winner address, or zero address on tie
    winning_side: str         # "CREATOR", "OPPONENT", "TIE", or "PENDING"
    creator_score: u256       # 0 - 10
    opponent_score: u256      # 0 - 10
    ai_critique: str          # GenLayer consensus judge analysis
    mvp_quote: str            # Highlighted best line
    created_at: u256


@allow_storage
@dataclass
class PlayerStats:
    wins: u256
    losses: u256
    ties: u256
    total_earned: u256
    high_score: u256
try:
    _Contract = gl.contract.Contract
except (AttributeError, Exception):
    _Contract = gl.Contract


class RoastWars(_Contract):
    duels: TreeMap[u256, Duel]
    player_stats: TreeMap[Address, PlayerStats]
    balances: TreeMap[Address, u256]
    next_duel_id: u256
    owner: Address
    total_volume: u256

    def __init__(self):
        self.next_duel_id = u256(1)
        self.owner = gl.message.sender_address
        self.total_volume = u256(0)

    # ── Internal Helpers ──

    def _get_or_create_stats(self, player: Address) -> PlayerStats:
        if player in self.player_stats:
            return self.player_stats[player]
        stats = PlayerStats(
            wins=u256(0),
            losses=u256(0),
            ties=u256(0),
            total_earned=u256(0),
            high_score=u256(0)
        )
        self.player_stats[player] = stats
        return stats

    def _add_balance(self, user: Address, amount: u256) -> None:
        self.balances[user] = self.balances.get(user, u256(0)) + amount

    # ── Public Write Methods ──

    @gl.public.write.payable
    def create_duel(self, topic: str, mode: str, punchline: str) -> u256:
        """Create a new Roast or Compliment duel with staked wager."""
        sender = gl.message.sender_address
        stake = gl.message.value

        clean_topic = topic.strip()
        clean_mode = mode.strip().upper()
        clean_punchline = punchline.strip()

        if clean_mode not in ("ROAST", "COMPLIMENT"):
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Mode must be either 'ROAST' or 'COMPLIMENT'")

        if len(clean_topic) < 3 or len(clean_topic) > 120:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Topic must be between 3 and 120 characters")

        if len(clean_punchline) < 5 or len(clean_punchline) > 500:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Punchline must be between 5 and 500 characters")

        zero_addr = Address("0x0000000000000000000000000000000000000000")
        duel_id = self.next_duel_id
        self.next_duel_id += u256(1)

        duel = Duel(
            id=duel_id,
            creator=sender,
            opponent=zero_addr,
            topic=clean_topic,
            mode=clean_mode,
            stake=stake,
            status="OPEN",
            creator_punchline=clean_punchline,
            opponent_punchline="",
            winner=zero_addr,
            winning_side="PENDING",
            creator_score=u256(0),
            opponent_score=u256(0),
            ai_critique="",
            mvp_quote="",
            created_at=u256(0)
        )

        self.duels[duel_id] = duel
        self.total_volume += stake
        return duel_id

    @gl.public.write.payable
    def accept_duel(self, duel_id: u256, punchline: str) -> None:
        """Accept an open duel by matching the stake and delivering counter-punchline."""
        sender = gl.message.sender_address

        if duel_id not in self.duels:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Duel {duel_id} does not exist")

        duel = self.duels[duel_id]

        if duel.status != "OPEN":
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Duel is not open for challenges (Status: {duel.status})")

        if sender == duel.creator:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} You cannot battle against yourself")

        if gl.message.value != duel.stake:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Sent value ({gl.message.value}) does not match stake ({duel.stake})")

        clean_punchline = punchline.strip()
        if len(clean_punchline) < 5 or len(clean_punchline) > 500:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Punchline must be between 5 and 500 characters")

        duel.opponent = sender
        duel.opponent_punchline = clean_punchline
        duel.status = "ACCEPTED"
        self.duels[duel_id] = duel
        self.total_volume += duel.stake

    @gl.public.write
    def judge_duel(self, duel_id: u256) -> None:
        """Summon GenLayer AI consensus to evaluate both punchlines and crown the winner."""
        if duel_id not in self.duels:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Duel {duel_id} does not exist")

        duel = self.duels[duel_id]

        if duel.status != "ACCEPTED":
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Duel cannot be judged in status '{duel.status}'")

        # Construct strict Equivalence prompt for GenLayer validator consensus
        mode_criteria = (
            "This is a ROAST BATTLE. The goal is brutal, hilarious, witty comedy burns. "
            "Reward clever metaphors, surprising punchlines, and comedic timing. "
            "Do NOT penalize harsh roasts as long as they are playful comedy without hate speech or slurs."
            if duel.mode == "ROAST" else
            "This is a COMPLIMENT BATTLE. The goal is the most creative, wholesome, and delightfully poetic flattery. "
            "Reward heartwarming metaphors, lyrical wit, and unique charm."
        )

        prompt = (
            "You are the Grand AI Comedy Jury of RoastWars, an autonomous on-chain comedy club.\n"
            "Evaluate the two competing lines below and decide the victor based on wit, originality, and delivery.\n\n"
            f"TOPIC / TARGET: \"{duel.topic}\"\n"
            f"DUEL FORMAT: {duel.mode} BATTLE\n"
            f"RULESET: {mode_criteria}\n\n"
            "CONTENDERS:\n"
            f"[CONTENDER 1 (Creator)]: \"{duel.creator_punchline}\"\n"
            f"[CONTENDER 2 (Challenger)]: \"{duel.opponent_punchline}\"\n\n"
            "SCORING CRITERIA (0 to 10 scale each):\n"
            "1. Topic Relevance & Sharpness\n"
            "2. Wit, Wordplay & Uniqueness\n"
            "3. Punchline Impact & Delivery\n\n"
            "DETERMINATION RULES:\n"
            "- Assign an overall integer score (0-10) to each Contender.\n"
            "- If Contender 1 scores strictly higher, set winner to \"CREATOR\".\n"
            "- If Contender 2 scores strictly higher, set winner to \"OPPONENT\".\n"
            "- If equal, set winner to \"TIE\".\n"
            "- Write a 1-sentence hilarious critique summarizing why the winner won.\n"
            "- Highlight the single best punchline fragment as mvp_quote.\n\n"
            "Respond ONLY with valid JSON: "
            '{"winner": "CREATOR"|"OPPONENT"|"TIE", '
            '"creator_score": <int 0-10>, "opponent_score": <int 0-10>, '
            '"critique": "<string>", "mvp_quote": "<string>"}'
        )

        def leader_fn() -> dict:
            try:
                raw = gl.nondet.exec_prompt(prompt, response_format="json")
                parsed = raw if isinstance(raw, dict) else _parse_json(str(raw))
                w = str(parsed.get("winner", "TIE")).strip().upper()
                if w not in ("CREATOR", "OPPONENT", "TIE"):
                    raise gl.vm.UserError(f"{ERROR_LLM} Invalid winner from AI jury: {w}")
                return {
                    "winner": w,
                    "creator_score": int(parsed.get("creator_score", 5)),
                    "opponent_score": int(parsed.get("opponent_score", 5)),
                    "critique": str(parsed.get("critique", "The AI jury has deliberated.")).strip()[:800],
                    "mvp_quote": str(parsed.get("mvp_quote", "")).strip()[:300],
                }
            except gl.vm.UserError:
                raise
            except Exception as e:
                raise gl.vm.UserError(f"{ERROR_TRANSIENT} AI jury call failed: {str(e)}")

        def validator_fn(leaders_res) -> bool:
            if not isinstance(leaders_res, gl.vm.Return):
                try:
                    leader_fn()
                    return False
                except gl.vm.UserError:
                    return True
            try:
                vr = leader_fn()
                return vr.get("winner") == leaders_res.calldata.get("winner")
            except Exception:
                return False

        result = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)

        winner_str = result.get("winner", "TIE")
        c_score = result.get("creator_score", 5)
        o_score = result.get("opponent_score", 5)
        critique = result.get("critique", "The AI jury has deliberated.")
        mvp_quote = result.get("mvp_quote", "")

        c_score_u = u256(max(0, min(10, c_score)))
        o_score_u = u256(max(0, min(10, o_score)))

        duel.creator_score = c_score_u
        duel.opponent_score = o_score_u
        duel.ai_critique = critique
        duel.mvp_quote = mvp_quote

        total_pot = duel.stake * u256(2)
        zero_addr = Address("0x0000000000000000000000000000000000000000")

        creator_stats = self._get_or_create_stats(duel.creator)
        opponent_stats = self._get_or_create_stats(duel.opponent)

        if c_score_u > creator_stats.high_score:
            creator_stats.high_score = c_score_u
        if o_score_u > opponent_stats.high_score:
            opponent_stats.high_score = o_score_u

        if winner_str == "CREATOR":
            duel.winner = duel.creator
            duel.winning_side = "CREATOR"
            creator_stats.wins += u256(1)
            creator_stats.total_earned += total_pot
            opponent_stats.losses += u256(1)
            if total_pot > u256(0):
                self._add_balance(duel.creator, total_pot)

        elif winner_str == "OPPONENT":
            duel.winner = duel.opponent
            duel.winning_side = "OPPONENT"
            opponent_stats.wins += u256(1)
            opponent_stats.total_earned += total_pot
            creator_stats.losses += u256(1)
            if total_pot > u256(0):
                self._add_balance(duel.opponent, total_pot)

        else:
            # Tie — refund stakes back to both players
            duel.winner = zero_addr
            duel.winning_side = "TIE"
            creator_stats.ties += u256(1)
            opponent_stats.ties += u256(1)
            if duel.stake > u256(0):
                self._add_balance(duel.creator, duel.stake)
                self._add_balance(duel.opponent, duel.stake)

        duel.status = "RESOLVED"
        self.duels[duel_id] = duel
        self.player_stats[duel.creator] = creator_stats
        self.player_stats[duel.opponent] = opponent_stats

    @gl.public.write
    def cancel_duel(self, duel_id: u256) -> None:
        """Cancel an open duel before any challenger accepts, refunding creator stake."""
        sender = gl.message.sender_address

        if duel_id not in self.duels:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Duel {duel_id} does not exist")

        duel = self.duels[duel_id]

        if duel.creator != sender and sender != self.owner:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Only creator or owner can cancel the duel")

        if duel.status != "OPEN":
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Cannot cancel duel in status '{duel.status}'")

        duel.status = "CANCELLED"
        self.duels[duel_id] = duel

        if duel.stake > u256(0):
            self._add_balance(duel.creator, duel.stake)

    @gl.public.write
    def withdraw_balance(self) -> None:
        """Safe contract payout path that consumes credited balance before transferring GEN."""
        sender = gl.message.sender_address
        balance = self.balances.get(sender, u256(0))
        if balance == u256(0):
            raise gl.vm.UserError(f"{ERROR_EXPECTED} No balance to withdraw")

        # Checks-Effects-Interactions: consume/zero out balance BEFORE transfer to prevent replay & reentrancy
        self.balances[sender] = u256(0)

        # Transfer GEN to recipient account - do NOT suppress transfer exceptions; restore balance on failure
        try:
            recipient = gl.get_contract_at(sender)
            recipient.emit_transfer(value=u256(balance), on="finalized")
        except gl.vm.UserError:
            self.balances[sender] = balance
            raise
        except Exception as e:
            self.balances[sender] = balance
            raise gl.vm.UserError(f"{ERROR_TRANSIENT} Transfer execution failed: {str(e)}")

    @gl.public.write
    def withdraw(self) -> None:
        """Alias for withdraw_balance."""
        self.withdraw_balance()

    @gl.public.view
    def get_balance(self, player_address: str) -> int:
        """Return the claimable balance for a given player address."""
        zero = Address("0x0000000000000000000000000000000000000000")
        try:
            addr = Address(player_address) if player_address else zero
        except Exception:
            addr = zero
        return int(self.balances.get(addr, u256(0)))

    # ── Read-Only View Methods ──

    @gl.public.view
    def get_duel(self, duel_id: u256) -> dict:
        """Fetch details of a single duel."""
        if duel_id not in self.duels:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Duel {duel_id} not found")

        d = self.duels[duel_id]
        return {
            "id": int(d.id),
            "creator": str(d.creator),
            "opponent": str(d.opponent),
            "topic": d.topic,
            "mode": d.mode,
            "stake": int(d.stake),
            "status": d.status,
            "creator_punchline": d.creator_punchline,
            "opponent_punchline": d.opponent_punchline,
            "winner": str(d.winner),
            "winning_side": d.winning_side,
            "creator_score": int(d.creator_score),
            "opponent_score": int(d.opponent_score),
            "ai_critique": d.ai_critique,
            "mvp_quote": d.mvp_quote,
            "created_at": int(d.created_at)
        }

    @gl.public.view
    def get_duels(self, offset: u256, limit: u256) -> list:
        """Fetch paginated list of duels for the lobby."""
        total = int(self.next_duel_id) - 1
        start = int(offset)
        count = int(limit)

        if start > total or total <= 0:
            return []

        results = []
        # Return descending (most recent first)
        curr_id = total - start
        end_id = max(0, curr_id - count)

        while curr_id > end_id:
            d_id = u256(curr_id)
            if d_id in self.duels:
                d = self.duels[d_id]
                results.append({
                    "id": int(d.id),
                    "creator": str(d.creator),
                    "opponent": str(d.opponent),
                    "topic": d.topic,
                    "mode": d.mode,
                    "stake": int(d.stake),
                    "status": d.status,
                    "creator_punchline": d.creator_punchline,
                    "opponent_punchline": d.opponent_punchline,
                    "winner": str(d.winner),
                    "winning_side": d.winning_side,
                    "creator_score": int(d.creator_score),
                    "opponent_score": int(d.opponent_score),
                    "ai_critique": d.ai_critique,
                    "mvp_quote": d.mvp_quote
                })
            curr_id -= 1

        return results

    @gl.public.view
    def get_duel_count(self) -> int:
        """Total number of duels created."""
        return int(self.next_duel_id) - 1

    @gl.public.view
    def get_player_stats(self, player_address: str) -> dict:
        """Fetch statistics for a given player."""
        try:
            addr = Address(player_address)
        except Exception:
            return {"wins": 0, "losses": 0, "ties": 0, "total_earned": 0, "high_score": 0}

        if addr in self.player_stats:
            s = self.player_stats[addr]
            return {
                "wins": int(s.wins),
                "losses": int(s.losses),
                "ties": int(s.ties),
                "total_earned": int(s.total_earned),
                "high_score": int(s.high_score)
            }
        return {"wins": 0, "losses": 0, "ties": 0, "total_earned": 0, "high_score": 0}

    @gl.public.view
    def get_arena_stats(self) -> dict:
        """Fetch global arena statistics."""
        return {
            "total_duels": int(self.next_duel_id) - 1,
            "total_volume": int(self.total_volume),
            "owner": str(self.owner)
        }
