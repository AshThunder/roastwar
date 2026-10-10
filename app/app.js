/**
 * RoastWars — Autonomous On-Chain AI Comedy Arena
 * Frontend Controller & GenLayer Interaction Client
 * 100% On-Chain Data & Multi-Validator Consensus Execution
 */

// Deployed intelligent contract configuration on StudioNet
const CONTRACT_CONFIG = {
  address: "0xc3b21E949187120CdBd8f273F5d6b3d9963772eB",
  rpcUrl: "https://studio.genlayer.com/api",
  chainId: 61999,
  networkName: "GenLayer StudioNet"
};

// Player profiles available with unlocked keystores for testing
const ACCOUNTS = {
  deployer: {
    address: "0x8cbc478963705971F15052e579a8Eb4faF7B2211",
    privateKey: "0x1052b5c67ac26e29a640e4c3024a5df170ae387ae942a6059a37016f31f4f521",
    name: "Deployer Host",
    balance: "1,000.00 GEN"
  },
  alice: {
    address: "0x25b7a7d21cCf349fbA8245209A25Bbb36fBe4ffD",
    privateKey: "0x7d8fcfb7d83c869cd0bb3097062b1e798ea1a4c18a500e6bff5de4d56c1163db",
    name: "Alice The Savage",
    balance: "1,007,426.00 GEN"
  }
};

let currentAccount = ACCOUNTS.deployer;

// Live On-Chain Duels Store (Populated exclusively from GenLayer Contract)
let duels = [];
let arenaStats = { total_duels: 0, total_volume: 0, owner: "" };
let isLoading = false;

// Active Filter State
let currentFilter = "all";
let currentModeFilter = "ALL";

// DOM Elements
const duelsGrid = document.getElementById("duelsGrid");
const accountSelect = document.getElementById("accountSelect");
const filterTabs = document.querySelectorAll(".filter-tabs .tab-btn");
const modeFilter = document.getElementById("modeFilter");

// Modals
const createModal = document.getElementById("createModalOverlay");
const acceptModal = document.getElementById("acceptModalOverlay");
const juryModal = document.getElementById("juryModalOverlay");

// Stats elements
const statTotalDuels = document.getElementById("statTotalDuels");
const statTotalVolume = document.getElementById("statTotalVolume");
const statAIJudged = document.getElementById("statAIJudged");
const countAll = document.getElementById("countAll");
const countOpen = document.getElementById("countOpen");
const countAccepted = document.getElementById("countAccepted");
const countResolved = document.getElementById("countResolved");
const leaderboardBody = document.getElementById("leaderboardBody");

// Helper: Format Address
function formatAddr(addr) {
  if (!addr || addr === "0x0000000000000000000000000000000000000000") return "—";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

// Map Address to Known Display Name
function getAccountName(addr) {
  if (!addr) return null;
  const match = Object.values(ACCOUNTS).find(a => a.address.toLowerCase() === addr.toLowerCase());
  return match ? match.name : formatAddr(addr);
}

// GenLayer Client Factory
function getGenLayerClient(accountObj = null) {
  if (!window.GenLayer) {
    throw new Error("GenLayer Web Client SDK is initializing. Please try again in a moment.");
  }
  const opts = {
    chain: window.GenLayer.studionet,
    transport: CONTRACT_CONFIG.rpcUrl
  };
  if (accountObj && accountObj.privateKey) {
    opts.account = window.GenLayer.privateKeyToAccount(accountObj.privateKey);
  }
  return window.GenLayer.createClient(opts);
}

// Transaction Polling Helper
async function pollTransaction(client, hash, statusMessage = "Validating on-chain...") {
  showToast(statusMessage, "info");
  for (let i = 0; i < 200; i++) {
    try {
      const tx = await client.getTransaction({ hash });
      if (tx.statusName === "ACCEPTED" || tx.statusName === "FINALIZED") {
        return tx;
      }
      if (tx.statusName === "ERROR" || tx.statusName?.includes("ERROR") || tx.statusName === "LEADER_TIMEOUT") {
        throw new Error(`Transaction reverted: ${tx.statusName}`);
      }
    } catch (e) {
      if (e.message?.includes("Transaction reverted")) throw e;
    }
    await new Promise(r => setTimeout(r, 3000));
  }
  throw new Error("Transaction confirmation timed out");
}

// Fetch Real On-Chain Data from GenLayer Intelligent Contract
async function fetchOnChainData(showToastNotification = false) {
  try {
    isLoading = true;
    const client = getGenLayerClient();

    // 1. Fetch total duel count
    const countBig = await client.readContract({
      address: CONTRACT_CONFIG.address,
      functionName: "get_duel_count",
      args: []
    });
    const count = Number(countBig);

    // 2. Fetch all duels
    if (count > 0) {
      const rawDuels = await client.readContract({
        address: CONTRACT_CONFIG.address,
        functionName: "get_duels",
        args: [0, count]
      });

      duels = rawDuels.map(d => {
        let stakeEth = 0;
        try {
          stakeEth = parseFloat(window.GenLayer.formatEther(BigInt(d.stake)));
        } catch (_) {
          stakeEth = Number(d.stake) / 1e18;
        }

        const isOpponentEmpty = !d.opponent || d.opponent === "0x0000000000000000000000000000000000000000";
        const isWinnerEmpty = !d.winner || d.winner === "0x0000000000000000000000000000000000000000";

        return {
          id: Number(d.id),
          topic: d.topic,
          mode: d.mode,
          stake: stakeEth,
          status: d.status,
          creator: d.creator,
          creator_name: getAccountName(d.creator),
          opponent: isOpponentEmpty ? null : d.opponent,
          opponent_name: isOpponentEmpty ? null : getAccountName(d.opponent),
          creator_punchline: d.creator_punchline,
          opponent_punchline: d.opponent_punchline,
          winner: isWinnerEmpty ? null : d.winner,
          winning_side: d.winning_side,
          creator_score: Number(d.creator_score),
          opponent_score: Number(d.opponent_score),
          ai_critique: d.ai_critique || "",
          mvp_quote: d.mvp_quote || "",
          created_at: Number(d.created_at) > 0 ? Number(d.created_at) * 1000 : Date.now()
        };
      });
    } else {
      duels = [];
    }

    // 3. Fetch global arena statistics
    try {
      const stats = await client.readContract({
        address: CONTRACT_CONFIG.address,
        functionName: "get_arena_stats",
        args: []
      });
      arenaStats = {
        total_duels: Number(stats.total_duels),
        total_volume: parseFloat(window.GenLayer.formatEther(BigInt(stats.total_volume))),
        owner: stats.owner
      };
    } catch (e) {
      console.warn("Could not fetch arena stats:", e);
    }

    // 4. Update balances of active accounts
    await updateAccountBalances(client);

    renderDuels();
    renderLeaderboard();

    if (showToastNotification) {
      showToast(`🔄 Synced ${duels.length} on-chain battles from StudioNet!`, "success");
    }
  } catch (err) {
    console.error("Failed to fetch on-chain duels:", err);
    showToast("Error reading contract: " + (err.message || err), "error");
  } finally {
    isLoading = false;
  }
}

// Live Account Balance Syncer
async function updateAccountBalances(client) {
  try {
    for (const key of Object.keys(ACCOUNTS)) {
      const acc = ACCOUNTS[key];
      const balWei = await client.getBalance({ address: acc.address });
      const balGen = parseFloat(window.GenLayer.formatEther(balWei));
      acc.balance = `${balGen.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 })} GEN`;
    }

    // Update select options
    const select = document.getElementById("accountSelect");
    if (select) {
      select.innerHTML = Object.keys(ACCOUNTS).map(k => {
        const a = ACCOUNTS[k];
        const isSelected = currentAccount.address.toLowerCase() === a.address.toLowerCase();
        return `<option value="${k}" ${isSelected ? 'selected' : ''}>${a.name} (${formatAddr(a.address)}) • ${a.balance}</option>`;
      }).join("");
    }
  } catch (e) {
    console.warn("Balance update warning:", e);
  }
}

// Update Top Stats & Tab Badges
function updateStatsAndBadges() {
  const total = duels.length;
  const openCount = duels.filter(d => d.status === "OPEN").length;
  const acceptedCount = duels.filter(d => d.status === "ACCEPTED").length;
  const resolvedCount = duels.filter(d => d.status === "RESOLVED").length;
  
  const totalVolume = duels.reduce((sum, d) => {
    return sum + (d.status === "OPEN" ? d.stake : d.stake * 2);
  }, 0);

  statTotalDuels.textContent = total;
  statTotalVolume.textContent = `${totalVolume.toFixed(2)} GEN`;
  statAIJudged.textContent = resolvedCount;

  countAll.textContent = total;
  countOpen.textContent = openCount;
  countAccepted.textContent = acceptedCount;
  countResolved.textContent = resolvedCount;
}

// Render Duel Cards
function renderDuels() {
  updateStatsAndBadges();

  let filtered = duels.filter(duel => {
    if (currentFilter !== "all" && duel.status !== currentFilter) return false;
    if (currentModeFilter !== "ALL" && duel.mode !== currentModeFilter) return false;
    return true;
  });

  if (filtered.length === 0) {
    duelsGrid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; background: #FFFFFF; border: 3px dashed var(--border); box-shadow: var(--shadow-md);">
        <div style="font-size: 44px; margin-bottom: 12px;">⚔️</div>
        <h3 style="font-family: var(--font-headline); font-size: 22px; margin-bottom: 8px;">NO DUELS MATCH THIS FILTER</h3>
        <p style="color: var(--text-muted); font-size: 14px; margin-bottom: 20px; font-weight: 500;">Be the legend who ignites the arena with a new challenge!</p>
        <button class="btn btn-primary" onclick="openCreateModal()">🔥 Ignite Duel</button>
      </div>
    `;
    return;
  }

  duelsGrid.innerHTML = filtered.map(duel => {
    const isRoast = duel.mode === "ROAST";
    const pot = duel.stake * 2;
    const isResolved = duel.status === "RESOLVED";
    const isAccepted = duel.status === "ACCEPTED";
    const isOpen = duel.status === "OPEN";

    let actionBtn = "";
    if (isOpen) {
      actionBtn = `<button class="btn btn-primary" onclick="openAcceptModal(${duel.id})">⚔️ Accept Challenge (${duel.stake} GEN)</button>`;
    } else if (isAccepted) {
      actionBtn = `<button class="btn btn-primary" onclick="openJuryModal(${duel.id})">⚖️ Summon AI Jury Consensus</button>`;
    } else if (isResolved) {
      actionBtn = `<button class="btn btn-secondary" onclick="openJuryModal(${duel.id})">🏆 View Jury Deliberation & Scores</button>`;
    }

    return `
      <div class="duel-card">
        <div class="duel-card-header">
          <span class="duel-battle-id">BATTLE #${duel.id}</span>
          <div class="duel-badges-wrap">
            <span class="badge ${isRoast ? 'badge-roast' : 'badge-compliment'}">
              ${isRoast ? '🔥 ROAST' : '💖 COMPLIMENT'}
            </span>
            <span class="badge badge-status ${duel.status.toLowerCase()}">
              ${duel.status}
            </span>
          </div>
        </div>

        <div class="duel-card-body">
          <div class="duel-stakes-bar">
            <span>💰 STAKE: ${duel.stake.toFixed(2)} GEN</span>
            <span class="duel-pot-val">🏆 POT: ${pot.toFixed(2)} GEN</span>
          </div>

          <div class="duel-topic">${escapeHtml(duel.topic)}</div>

          <div class="contenders-container">
            <!-- Contender 1 (Creator) -->
            <div class="contender-box ${duel.winner && duel.winner.toLowerCase() === duel.creator.toLowerCase() ? 'winner-box' : ''}">
              <div class="contender-meta">
                <span class="contender-role">
                  <span>🎭</span> Creator: ${duel.creator_name || formatAddr(duel.creator)}
                </span>
                <div style="display: flex; gap: 4px; align-items: center;">
                  ${isResolved && duel.winner && duel.winner.toLowerCase() === duel.creator.toLowerCase() ? '<span class="winner-crown-tag">👑 Victor</span>' : ''}
                  ${isResolved ? `<span class="contender-score-pill">${duel.creator_score}/10</span>` : ''}
                </div>
              </div>
              <div class="punchline-quote">"${escapeHtml(duel.creator_punchline)}"</div>
            </div>

            <!-- Contender 2 (Challenger) -->
            ${duel.opponent ? `
              <div class="contender-box ${duel.winner && duel.winner.toLowerCase() === duel.opponent.toLowerCase() ? 'winner-box' : ''}">
                <div class="contender-meta">
                  <span class="contender-role">
                    <span>⚔️</span> Challenger: ${duel.opponent_name || formatAddr(duel.opponent)}
                  </span>
                  <div style="display: flex; gap: 4px; align-items: center;">
                    ${isResolved && duel.winner && duel.winner.toLowerCase() === duel.opponent.toLowerCase() ? '<span class="winner-crown-tag">👑 Victor</span>' : ''}
                    ${isResolved ? `<span class="contender-score-pill">${duel.opponent_score}/10</span>` : ''}
                  </div>
                </div>
                <div class="punchline-quote">"${escapeHtml(duel.opponent_punchline)}"</div>
              </div>
            ` : `
              <div class="awaiting-challenger-box">
                <span>⏳ Awaiting opponent to match ${duel.stake.toFixed(2)} GEN stake...</span>
              </div>
            `}
          </div>
        </div>

        <div class="duel-card-footer">
          ${actionBtn}
        </div>
      </div>
    `;
  }).join("");
}

// Render Leaderboard
function renderLeaderboard() {
  const playerStats = {};

  // Build aggregate records from registered accounts
  Object.values(ACCOUNTS).forEach(acc => {
    playerStats[acc.address.toLowerCase()] = {
      address: acc.address,
      name: acc.name,
      wins: 0,
      losses: 0,
      totalEarned: 0,
      highScore: 0
    };
  });

  duels.forEach(duel => {
    if (duel.status !== "RESOLVED") return;
    const cAddr = duel.creator.toLowerCase();
    const oAddr = duel.opponent ? duel.opponent.toLowerCase() : null;

    if (!playerStats[cAddr]) playerStats[cAddr] = { address: duel.creator, name: formatAddr(duel.creator), wins: 0, losses: 0, totalEarned: 0, highScore: 0 };
    if (oAddr && !playerStats[oAddr]) playerStats[oAddr] = { address: duel.opponent, name: formatAddr(duel.opponent), wins: 0, losses: 0, totalEarned: 0, highScore: 0 };

    if (duel.creator_score > playerStats[cAddr].highScore) playerStats[cAddr].highScore = duel.creator_score;
    if (oAddr && duel.opponent_score > playerStats[oAddr].highScore) playerStats[oAddr].highScore = duel.opponent_score;

    if (duel.winning_side === "CREATOR") {
      playerStats[cAddr].wins++;
      playerStats[cAddr].totalEarned += duel.stake * 2;
      if (oAddr) playerStats[oAddr].losses++;
    } else if (duel.winning_side === "OPPONENT" && oAddr) {
      playerStats[oAddr].wins++;
      playerStats[oAddr].totalEarned += duel.stake * 2;
      playerStats[cAddr].losses++;
    }
  });

  const sorted = Object.values(playerStats).sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    return b.totalEarned - a.totalEarned;
  });

  leaderboardBody.innerHTML = sorted.map((p, index) => {
    const totalBattles = p.wins + p.losses;
    const winRate = totalBattles > 0 ? Math.round((p.wins / totalBattles) * 100) : 0;
    const rankClass = index === 0 ? 'rank-1' : index === 1 ? 'rank-2' : index === 2 ? 'rank-3' : '';

    return `
      <tr>
        <td><span class="rank-badge ${rankClass}">#${index + 1}</span></td>
        <td>
          <div class="player-name-cell">
            <span class="player-avatar">${index === 0 ? '👑' : '🎭'}</span>
            <div>
              <strong>${p.name}</strong>
              <div class="player-addr-sub">${p.address}</div>
            </div>
          </div>
        </td>
        <td><strong>${p.wins}</strong> W / <span style="color: var(--text-muted);">${p.losses} L</span></td>
        <td><strong style="font-family: var(--font-headline);">${winRate}%</strong></td>
        <td><span style="font-family: var(--font-mono); color: var(--primary); font-weight: 800;">${p.highScore}/10</span></td>
        <td><strong style="color: var(--accent-gold); font-family: var(--font-mono); font-weight: 800;">${p.totalEarned.toFixed(2)} GEN</strong></td>
      </tr>
    `;
  }).join("");
}

// Modal Handlers
function openCreateModal() {
  createModal.classList.add("open");
}
function closeCreateModal() {
  createModal.classList.remove("open");
}

function openAcceptModal(duelId) {
  const duel = duels.find(d => d.id === duelId);
  if (!duel) return;

  document.getElementById("acceptDuelId").value = duel.id;
  document.getElementById("acceptTopicBadge").textContent = `Topic: ${duel.topic} (${duel.mode} Format)`;
  document.getElementById("acceptCreatorPunchline").textContent = `"${duel.creator_punchline}"`;
  document.getElementById("acceptStakeAmount").textContent = `${duel.stake} GEN`;
  document.getElementById("opponentPunchline").value = "";
  document.getElementById("acceptCharCount").textContent = "0";

  acceptModal.classList.add("open");
}
function closeAcceptModal() {
  acceptModal.classList.remove("open");
}

// Jury Chamber Modal
function openJuryModal(duelId) {
  const duel = duels.find(d => d.id === duelId);
  if (!duel) return;

  const pot = duel.stake * 2;
  document.getElementById("juryFormatBadge").textContent = duel.mode === "ROAST" ? "🔥 ROAST BATTLE" : "💖 COMPLIMENT DUEL";
  document.getElementById("juryTopicBadge").textContent = `TOPIC: ${duel.topic}`;
  document.getElementById("juryPotBadge").textContent = `POT: ${pot.toFixed(2)} GEN`;

  document.getElementById("juryCreatorAddr").textContent = duel.creator_name ? `${duel.creator_name} (${formatAddr(duel.creator)})` : formatAddr(duel.creator);
  document.getElementById("juryCreatorLine").textContent = `"${duel.creator_punchline}"`;
  document.getElementById("juryCreatorScore").textContent = duel.status === "RESOLVED" ? duel.creator_score : "—";
  document.getElementById("juryCreatorScoreBar").style.width = duel.status === "RESOLVED" ? `${duel.creator_score * 10}%` : "0%";

  document.getElementById("juryOpponentAddr").textContent = duel.opponent_name ? `${duel.opponent_name} (${formatAddr(duel.opponent)})` : formatAddr(duel.opponent);
  document.getElementById("juryOpponentLine").textContent = `"${duel.opponent_punchline || 'Awaiting Line...'}"`;
  document.getElementById("juryOpponentScore").textContent = duel.status === "RESOLVED" ? duel.opponent_score : "—";
  document.getElementById("juryOpponentScoreBar").style.width = duel.status === "RESOLVED" ? `${duel.opponent_score * 10}%` : "0%";

  const verdictBanner = document.getElementById("verdictBanner");
  const verdictWinnerText = document.getElementById("verdictWinnerText");
  const verdictPayoutText = document.getElementById("verdictPayoutText");
  const critiqueText = document.getElementById("juryCritiqueText");
  const mvpWrap = document.getElementById("juryMvpWrap");
  const mvpQuote = document.getElementById("juryMvpQuote");
  const actionFooter = document.getElementById("juryActionFooter");

  if (duel.status === "RESOLVED") {
    verdictBanner.style.display = "flex";
    verdictWinnerText.textContent = duel.winning_side === "CREATOR"
      ? `👑 ${duel.creator_name || 'CREATOR'} WINS!`
      : duel.winning_side === "OPPONENT"
      ? `👑 ${duel.opponent_name || 'CHALLENGER'} WINS!`
      : `🤝 IT'S A COMEDY TIE!`;
    verdictPayoutText.textContent = duel.winning_side === "TIE"
      ? `Pot split equally: ${(pot / 2).toFixed(2)} GEN to each contender`
      : `${pot.toFixed(2)} GEN prize pot transferred to winner's internal ledger`;

    critiqueText.textContent = `"${duel.ai_critique}"`;
    if (duel.mvp_quote) {
      mvpWrap.style.display = "flex";
      mvpQuote.textContent = `"${duel.mvp_quote}"`;
    } else {
      mvpWrap.style.display = "none";
    }

    actionFooter.style.display = "none";
  } else {
    verdictBanner.style.display = "none";
    critiqueText.textContent = "Awaiting execution of the Grand AI Comedy Jury consensus on-chain...";
    mvpWrap.style.display = "none";
    actionFooter.style.display = "block";

    const btnJudge = document.getElementById("btnExecuteJudge");
    btnJudge.onclick = () => executeJudgeDuel(duel.id);
  }

  juryModal.classList.add("open");
}
function closeJuryModal() {
  juryModal.classList.remove("open");
}

// Execute AI Jury Consensus (Real On-Chain Write via GenLayer Validators)
async function executeJudgeDuel(duelId) {
  const duel = duels.find(d => d.id === duelId);
  if (!duel) return;

  const btnJudge = document.getElementById("btnExecuteJudge");
  btnJudge.disabled = true;
  btnJudge.innerHTML = `<span class="status-dot pulsing" style="background:#fbbf24;"></span> Summoning GenLayer Validators...`;

  showToast("Deliberating via GenLayer LLM equivalence consensus...", "info");

  // Animate validator nodes
  const nodes = document.querySelectorAll(".consensus-validators-bar .validator-node");
  nodes.forEach((n, idx) => {
    setTimeout(() => {
      n.style.transform = "scale(1.05)";
      n.style.borderColor = "var(--primary)";
      n.style.boxShadow = "2px 2px 0px var(--primary)";
    }, idx * 300);
  });

  try {
    const client = getGenLayerClient(currentAccount);
    const hash = await client.writeContract({
      address: CONTRACT_CONFIG.address,
      functionName: "judge_duel",
      args: [duelId],
    });

    btnJudge.innerHTML = `<span class="status-dot pulsing" style="background:#10b981;"></span> Reaching Consensus...`;
    await pollTransaction(client, hash, "Validators voting on punchlines...");

    showToast("🏆 AI Jury Consensus finalized on-chain!", "success");
    await fetchOnChainData();
    openJuryModal(duelId);
  } catch (err) {
    console.error("AI Judging failed:", err);
    showToast("AI Consensus failed: " + (err.message || err), "error");
  } finally {
    btnJudge.disabled = false;
    btnJudge.innerHTML = `<span class="btn-icon">⚖️</span><span>Summon AI Jury Consensus</span>`;
  }
}

// Toast Notifications
function showToast(message, type = "info") {
  const container = document.getElementById("toastContainer");
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span>${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span>
    <span>${message}</span>
  `;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(50px)";
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Form Handlers: Real On-Chain Create Duel
document.getElementById("createDuelForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const topic = document.getElementById("duelTopic").value.trim();
  const mode = document.querySelector('input[name="duelMode"]:checked').value;
  const punchline = document.getElementById("creatorPunchline").value.trim();
  const stake = parseFloat(document.getElementById("duelStake").value);

  if (!topic || !punchline || isNaN(stake) || stake <= 0) {
    showToast("Please provide valid topic, punchline and stake amount", "error");
    return;
  }

  const submitBtn = e.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.innerHTML = `<span class="status-dot pulsing"></span> Sending to GenLayer...`;

  try {
    const client = getGenLayerClient(currentAccount);
    const stakeWei = window.GenLayer.parseEther(stake.toString());

    const hash = await client.writeContract({
      address: CONTRACT_CONFIG.address,
      functionName: "create_duel",
      args: [topic, mode, punchline],
      value: stakeWei,
    });

    closeCreateModal();
    document.getElementById("createDuelForm").reset();
    document.getElementById("charCount").textContent = "0";
    document.getElementById("totalPotPreview").textContent = "2.0 GEN";

    await pollTransaction(client, hash, "Submitting new duel to StudioNet...");
    showToast("⚡ Duel successfully created on-chain!", "success");
    await fetchOnChainData();
  } catch (err) {
    console.error("Create Duel Error:", err);
    showToast("Failed to create duel: " + (err.message || err), "error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = `<span>🔥 Ignite Battle</span>`;
  }
});

// Form Handlers: Real On-Chain Accept Duel
document.getElementById("acceptDuelForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const duelId = parseInt(document.getElementById("acceptDuelId").value);
  const punchline = document.getElementById("opponentPunchline").value.trim();

  const duel = duels.find(d => d.id === duelId);
  if (!duel) return;

  const submitBtn = e.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.innerHTML = `<span class="status-dot pulsing"></span> Locking Wager...`;

  try {
    const client = getGenLayerClient(currentAccount);
    const stakeWei = window.GenLayer.parseEther(duel.stake.toString());

    const hash = await client.writeContract({
      address: CONTRACT_CONFIG.address,
      functionName: "accept_duel",
      args: [duelId, punchline],
      value: stakeWei,
    });

    closeAcceptModal();
    await pollTransaction(client, hash, "Matching duel wager on StudioNet...");
    showToast("⚔️ Challenge matched on-chain! Duel ready for AI Jury.", "success");
    await fetchOnChainData();
  } catch (err) {
    console.error("Accept Duel Error:", err);
    showToast("Failed to accept duel: " + (err.message || err), "error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = `<span>⚔️ Lock Stake & Deliver Line</span>`;
  }
});

// Character count live listeners
document.getElementById("creatorPunchline").addEventListener("input", (e) => {
  document.getElementById("charCount").textContent = e.target.value.length;
});
document.getElementById("opponentPunchline").addEventListener("input", (e) => {
  document.getElementById("acceptCharCount").textContent = e.target.value.length;
});

// Stake change preview listener
document.getElementById("duelStake").addEventListener("input", (e) => {
  const val = parseFloat(e.target.value) || 0;
  document.getElementById("totalPotPreview").textContent = `${(val * 2).toFixed(2)} GEN`;
});

// Mode toggle listener
document.querySelectorAll('input[name="duelMode"]').forEach(radio => {
  radio.addEventListener("change", (e) => {
    document.getElementById("modeOptionRoast").classList.toggle("active", e.target.value === "ROAST");
    document.getElementById("modeOptionCompliment").classList.toggle("active", e.target.value === "COMPLIMENT");
  });
});

// Topic presets click listener
document.querySelectorAll(".preset-tag").forEach(tag => {
  tag.addEventListener("click", () => {
    document.getElementById("duelTopic").value = tag.getAttribute("data-topic");
  });
});

// Filter tabs click listener
filterTabs.forEach(tab => {
  tab.addEventListener("click", () => {
    filterTabs.forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    currentFilter = tab.getAttribute("data-filter");
    renderDuels();
  });
});

// Mode filter change listener
modeFilter.addEventListener("change", (e) => {
  currentModeFilter = e.target.value;
  renderDuels();
});

// Account select change listener
accountSelect.addEventListener("change", (e) => {
  const selectedKey = e.target.value;
  if (ACCOUNTS[selectedKey]) {
    currentAccount = ACCOUNTS[selectedKey];
    showToast(`Switched active player: ${currentAccount.name}`, "info");
  }
});

// Sync on-chain button
document.getElementById("btnSyncOnChain")?.addEventListener("click", () => {
  fetchOnChainData(true);
});

// Modal close button listeners
document.getElementById("btnOpenCreateModal").addEventListener("click", openCreateModal);
document.getElementById("btnHeroCreate").addEventListener("click", openCreateModal);
document.getElementById("btnCloseCreateModal").addEventListener("click", closeCreateModal);
document.getElementById("btnCancelCreate").addEventListener("click", closeCreateModal);

document.getElementById("btnCloseAcceptModal").addEventListener("click", closeAcceptModal);
document.getElementById("btnCancelAccept").addEventListener("click", closeAcceptModal);

document.getElementById("btnCloseJuryModal").addEventListener("click", closeJuryModal);

document.getElementById("btnExploreLobby").addEventListener("click", () => {
  document.getElementById("arenaLobby").scrollIntoView({ behavior: "smooth" });
});

document.getElementById("btnQuickDemo").addEventListener("click", () => {
  fetchOnChainData(true);
  document.getElementById("arenaLobby").scrollIntoView({ behavior: "smooth" });
});

// Close modals on escape key or clicking overlay background
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeCreateModal();
    closeAcceptModal();
    closeJuryModal();
  }
});

[createModal, acceptModal, juryModal].forEach(overlay => {
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) {
      overlay.classList.remove("open");
    }
  });
});

// Initialize on Load: Fetch Live On-Chain Data
window.addEventListener("DOMContentLoaded", () => {
  fetchOnChainData();
});
