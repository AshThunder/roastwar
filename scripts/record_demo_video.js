import puppeteer from 'puppeteer-core';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

const RAW_VIDEO = path.resolve('assets/raw_video.mp4');
const FINAL_VIDEO = path.resolve('assets/roastwars_demo.mp4');
const AUDIO_FILE = path.resolve('assets/audio_master.aac');
const TIMING_FILE = path.resolve('assets/demo_timing.json');
const LIVE_URL = 'https://roastwar.vercel.app/';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function record() {
  console.log('=== Starting RoastWars Motion Design + Walkthrough Recording ===');
  console.log(`Target URL: ${LIVE_URL}`);
  console.log(`Raw Video Output: ${RAW_VIDEO}`);

  const timingData = JSON.parse(fs.readFileSync(TIMING_FILE, 'utf8'));
  console.log(`Planned Total Duration: ${timingData.total_duration}s across ${timingData.cues.length} scenes.`);

  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-extensions',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--window-size=1920,1080'
    ]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });

  const ffmpeg = spawn('/home/michael/.local/bin/ffmpeg', [
    '-y',
    '-f', 'image2pipe',
    '-vcodec', 'mjpeg',
    '-r', '20',
    '-i', '-',
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-preset', 'fast',
    '-crf', '19',
    RAW_VIDEO
  ]);

  ffmpeg.stderr.on('data', (d) => {
    const str = d.toString();
    if (str.includes('Error') || str.includes('fatal')) {
      console.error('FFMPEG:', str);
    }
  });

  let frameCount = 0;
  async function recordFrame() {
    const buf = await page.screenshot({ type: 'jpeg', quality: 93 });
    ffmpeg.stdin.write(buf);
    frameCount++;
  }

  async function holdScene(seconds) {
    const count = Math.max(1, Math.round(seconds * 20));
    for (let i = 0; i < count; i++) {
      await recordFrame();
      await sleep(15);
    }
  }

  async function smoothScroll(fromY, toY, seconds) {
    const totalFrames = Math.max(1, Math.round(seconds * 20));
    for (let i = 0; i <= totalFrames; i++) {
      const progress = i / totalFrames;
      const ease = progress < 0.5 
        ? 4 * progress * progress * progress 
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;
      const currentY = fromY + (toY - fromY) * ease;
      await page.evaluate((y) => window.scrollTo(0, y), currentY);
      await recordFrame();
      await sleep(15);
    }
  }

  try {
    console.log('Navigating to live RoastWars web application...');
    await page.goto(LIVE_URL, { waitUntil: 'networkidle2', timeout: 30000 });

    // Inject Motion Design Elements & Subtitle Engine
    await page.evaluate(() => {
      // 1. Inject Motion Subtitle Bar
      const subBar = document.createElement('div');
      subBar.id = 'motionSubBar';
      subBar.style.position = 'fixed';
      subBar.style.bottom = '26px';
      subBar.style.left = '50%';
      subBar.style.transform = 'translateX(-50%)';
      subBar.style.background = 'rgba(15, 23, 42, 0.96)';
      subBar.style.backdropFilter = 'blur(16px)';
      subBar.style.color = '#FFFFFF';
      subBar.style.border = '2px solid #EA580C';
      subBar.style.borderRadius = '12px';
      subBar.style.boxShadow = '0 10px 30px rgba(0,0,0,0.8), 0 0 20px rgba(234, 88, 12, 0.3)';
      subBar.style.padding = '12px 32px';
      subBar.style.fontFamily = "'Space Grotesk', -apple-system, sans-serif";
      subBar.style.fontSize = '17px';
      subBar.style.fontWeight = '800';
      subBar.style.letterSpacing = '-0.01em';
      subBar.style.textTransform = 'uppercase';
      subBar.style.zIndex = '9999999';
      subBar.style.display = 'flex';
      subBar.style.alignItems = 'center';
      subBar.style.gap = '14px';
      subBar.style.transition = 'all 0.4s ease';
      subBar.innerHTML = `
        <span style="display:inline-block; width:10px; height:10px; background:#EA580C; border-radius:50%; box-shadow:0 0 12px #EA580C;"></span>
        <span id="motionSubText">ROASTWARS — AUTONOMOUS ON-CHAIN AI COMEDY ARENA</span>
      `;
      document.body.appendChild(subBar);

      window.setSubtitle = (text, dotColor = '#EA580C') => {
        const el = document.getElementById('motionSubText');
        const bar = document.getElementById('motionSubBar');
        if (el) el.textContent = text;
        if (bar) {
          bar.style.borderColor = dotColor;
          bar.style.boxShadow = `0 10px 30px rgba(0,0,0,0.8), 0 0 20px ${dotColor}40`;
          const dot = bar.querySelector('span:first-child');
          if (dot) {
            dot.style.background = dotColor;
            dot.style.boxShadow = `0 0 12px ${dotColor}`;
          }
        }
      };

      // 2. Full-Screen Motion Graphic Overlay Container
      const motionOverlay = document.createElement('div');
      motionOverlay.id = 'fullMotionOverlay';
      motionOverlay.style.position = 'fixed';
      motionOverlay.style.top = '0';
      motionOverlay.style.left = '0';
      motionOverlay.style.width = '100vw';
      motionOverlay.style.height = '100vh';
      motionOverlay.style.background = '#0B0F19';
      motionOverlay.style.zIndex = '9999990';
      motionOverlay.style.display = 'flex';
      motionOverlay.style.flexDirection = 'column';
      motionOverlay.style.alignItems = 'center';
      motionOverlay.style.justifyContent = 'center';
      motionOverlay.style.padding = '60px';
      motionOverlay.style.boxSizing = 'border-box';
      motionOverlay.style.transition = 'opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1), transform 0.8s cubic-bezier(0.16, 1, 0.3, 1)';
      motionOverlay.style.fontFamily = "'Space Grotesk', -apple-system, sans-serif";
      motionOverlay.style.overflow = 'hidden';

      // Cyber grid background pattern
      motionOverlay.innerHTML = `
        <div style="position:absolute; inset:0; background-image: radial-gradient(#EA580C 1px, transparent 1px), radial-gradient(#38BDF8 1px, #0B0F19 1px); background-size: 40px 40px; background-position: 0 0, 20px 20px; opacity: 0.15; pointer-events:none;"></div>
        <div id="motionCardContent" style="position:relative; z-index:2; width:100%; max-width:1400px; display:flex; flex-direction:column; align-items:center;"></div>
      `;
      document.body.appendChild(motionOverlay);

      // Function to render Scene 1 Motion Graphic
      window.renderMotionScene1 = () => {
        const c = document.getElementById('motionCardContent');
        c.innerHTML = `
          <div style="display:flex; align-items:center; gap:12px; margin-bottom:20px;">
            <span style="background:rgba(234, 88, 12, 0.15); border:1.5px solid #EA580C; color:#EA580C; padding:6px 16px; border-radius:999px; font-size:14px; font-weight:800; letter-spacing:0.08em; text-transform:uppercase;">
              GENLAYER INTELLIGENT CONTRACTS • STUDIONET
            </span>
          </div>

          <h1 style="font-size:56px; font-weight:900; letter-spacing:-0.03em; color:#FFFFFF; margin:0 0 12px 0; text-align:center; line-height:1.1;">
            WHY <span style="background:linear-gradient(135deg, #FF6B00 0%, #FFA800 100%); -webkit-background-clip:text; -webkit-text-fill-color:transparent;">ROASTWARS</span>?
          </h1>
          <p style="font-size:22px; color:#94A3B8; margin:0 0 44px 0; text-align:center; max-width:800px; font-weight:500;">
            The paradigm shift from deterministic smart contracts to subjective on-chain intelligence.
          </p>

          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:36px; width:100%;">
            <!-- Left Card: Traditional Smart Contracts -->
            <div style="background:rgba(30, 41, 59, 0.7); border:2px solid #334155; border-radius:20px; padding:36px; box-shadow:0 20px 40px rgba(0,0,0,0.5); display:flex; flex-direction:column;">
              <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:24px;">
                <span style="font-size:20px; font-weight:800; color:#EF4444; letter-spacing:-0.01em;">TRADITIONAL SMART CONTRACTS</span>
                <span style="background:#EF444420; color:#EF4444; border:1px solid #EF4444; padding:4px 12px; border-radius:8px; font-size:12px; font-weight:700;">DETERMINISTIC ONLY</span>
              </div>
              <ul style="list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:18px;">
                <li style="display:flex; align-items:flex-start; gap:14px; font-size:18px; color:#CBD5E1;">
                  <span style="color:#EF4444; font-size:20px;">✕</span>
                  <span>Calculates token balances and simple math arithmetic.</span>
                </li>
                <li style="display:flex; align-items:flex-start; gap:14px; font-size:18px; color:#CBD5E1;">
                  <span style="color:#EF4444; font-size:20px;">✕</span>
                  <span><strong>Blind to human wit</strong>, sarcasm, and subjective creativity.</span>
                </li>
                <li style="display:flex; align-items:flex-start; gap:14px; font-size:18px; color:#CBD5E1;">
                  <span style="color:#EF4444; font-size:20px;">✕</span>
                  <span>Cannot judge punchlines without centralized Web2 oracles.</span>
                </li>
              </ul>
            </div>

            <!-- Right Card: GenLayer Intelligent Contracts -->
            <div style="background:linear-gradient(135deg, rgba(234, 88, 12, 0.12) 0%, rgba(16, 185, 129, 0.08) 100%), rgba(15, 23, 42, 0.85); border:2.5px solid #EA580C; border-radius:20px; padding:36px; box-shadow:0 20px 40px rgba(234, 88, 12, 0.2); display:flex; flex-direction:column;">
              <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:24px;">
                <span style="font-size:20px; font-weight:800; color:#10B981; letter-spacing:-0.01em;">GENLAYER INTELLIGENT CONTRACTS</span>
                <span style="background:#10B98120; color:#10B981; border:1px solid #10B981; padding:4px 12px; border-radius:8px; font-size:12px; font-weight:700;">AI CONSENSUS NATIVE</span>
              </div>
              <ul style="list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:18px;">
                <li style="display:flex; align-items:flex-start; gap:14px; font-size:18px; color:#F8FAFC;">
                  <span style="color:#10B981; font-size:20px;">⚡</span>
                  <span>Validator nodes run <strong>LLMs directly inside BFT consensus</strong>.</span>
                </li>
                <li style="display:flex; align-items:flex-start; gap:14px; font-size:18px; color:#F8FAFC;">
                  <span style="color:#10B981; font-size:20px;">⚡</span>
                  <span>Evaluates comedic timing, metaphors, and punchlines on-chain.</span>
                </li>
                <li style="display:flex; align-items:flex-start; gap:14px; font-size:18px; color:#F8FAFC;">
                  <span style="color:#10B981; font-size:20px;">⚡</span>
                  <span>Autonomous escrow, instant 2x payouts, and zero gas fees.</span>
                </li>
              </ul>
            </div>
          </div>
        `;
      };

      // Function to render Scene 2 Motion Graphic
      window.renderMotionScene2 = () => {
        const c = document.getElementById('motionCardContent');
        c.innerHTML = `
          <div style="display:flex; align-items:center; gap:12px; margin-bottom:16px;">
            <span style="background:rgba(56, 189, 248, 0.15); border:1.5px solid #38BDF8; color:#38BDF8; padding:6px 16px; border-radius:999px; font-size:14px; font-weight:800; letter-spacing:0.08em; text-transform:uppercase;">
              AUTONOMOUS EQUIVALENCE CONSENSUS
            </span>
          </div>

          <h1 style="font-size:52px; font-weight:900; letter-spacing:-0.03em; color:#FFFFFF; margin:0 0 12px 0; text-align:center;">
            THE <span style="color:#38BDF8;">5-VALIDATOR</span> AI JURY ENGINE
          </h1>
          <p style="font-size:21px; color:#94A3B8; margin:0 0 40px 0; text-align:center; max-width:850px; font-weight:500;">
            Non-deterministic LLM inference evaluated inside Byzantine Fault Tolerant consensus.
          </p>

          <!-- 5-Node Validator Consensus Diagram -->
          <div style="display:grid; grid-template-columns: repeat(5, 1fr); gap:16px; width:100%; margin-bottom:32px;">
            <div style="background:rgba(30, 41, 59, 0.9); border:2px solid #38BDF8; border-radius:16px; padding:22px 16px; text-align:center;">
              <div style="width:40px; height:40px; border-radius:50%; background:#38BDF820; border:2px solid #38BDF8; margin:0 auto 12px auto; display:flex; align-items:center; justify-content:center; color:#38BDF8; font-weight:800; font-size:16px;">1</div>
              <div style="font-size:15px; font-weight:800; color:#FFFFFF; margin-bottom:6px;">LEADER NODE</div>
              <div style="font-size:12px; color:#94A3B8; line-height:1.4;">Executes LLM Prompt on Punchlines</div>
            </div>

            <div style="background:rgba(30, 41, 59, 0.9); border:2px solid #10B981; border-radius:16px; padding:22px 16px; text-align:center;">
              <div style="width:40px; height:40px; border-radius:50%; background:#10B98120; border:2px solid #10B981; margin:0 auto 12px auto; display:flex; align-items:center; justify-content:center; color:#10B981; font-weight:800; font-size:16px;">2</div>
              <div style="font-size:15px; font-weight:800; color:#FFFFFF; margin-bottom:6px;">VALIDATOR 2</div>
              <div style="font-size:12px; color:#94A3B8; line-height:1.4;">Scores Wit & Topic Relevance (0-10)</div>
            </div>

            <div style="background:rgba(30, 41, 59, 0.9); border:2px solid #10B981; border-radius:16px; padding:22px 16px; text-align:center;">
              <div style="width:40px; height:40px; border-radius:50%; background:#10B98120; border:2px solid #10B981; margin:0 auto 12px auto; display:flex; align-items:center; justify-content:center; color:#10B981; font-weight:800; font-size:16px;">3</div>
              <div style="font-size:15px; font-weight:800; color:#FFFFFF; margin-bottom:6px;">VALIDATOR 3</div>
              <div style="font-size:12px; color:#94A3B8; line-height:1.4;">Evaluates Delivery & Wordplay Impact</div>
            </div>

            <div style="background:rgba(30, 41, 59, 0.9); border:2px solid #10B981; border-radius:16px; padding:22px 16px; text-align:center;">
              <div style="width:40px; height:40px; border-radius:50%; background:#10B98120; border:2px solid #10B981; margin:0 auto 12px auto; display:flex; align-items:center; justify-content:center; color:#10B981; font-weight:800; font-size:16px;">4</div>
              <div style="font-size:15px; font-weight:800; color:#FFFFFF; margin-bottom:6px;">VALIDATOR 4</div>
              <div style="font-size:12px; color:#94A3B8; line-height:1.4;">Checks Equivalence with Leader Result</div>
            </div>

            <div style="background:rgba(30, 41, 59, 0.9); border:2px solid #EA580C; border-radius:16px; padding:22px 16px; text-align:center;">
              <div style="width:40px; height:40px; border-radius:50%; background:#EA580C20; border:2px solid #EA580C; margin:0 auto 12px auto; display:flex; align-items:center; justify-content:center; color:#EA580C; font-weight:800; font-size:16px;">5</div>
              <div style="font-size:15px; font-weight:800; color:#FFFFFF; margin-bottom:6px;">VALIDATOR 5</div>
              <div style="font-size:12px; color:#94A3B8; line-height:1.4;">Consensus Agrees: Winner Crowned!</div>
            </div>
          </div>

          <!-- Code Badge -->
          <div style="background:#0F172A; border:1px solid #334155; border-radius:12px; padding:14px 28px; display:flex; align-items:center; gap:16px;">
            <span style="color:#64748B; font-family:monospace; font-size:15px;">EXECUTION LAYER:</span>
            <code style="color:#38BDF8; font-family:'JetBrains Mono', monospace; font-size:17px; font-weight:700;">
              result = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)
            </code>
            <span style="background:#10B98120; color:#10B981; border:1px solid #10B981; padding:3px 10px; border-radius:6px; font-size:12px; font-weight:700;">BFT VERIFIED</span>
          </div>
        `;
      };

      // Function to hide motion overlay and reveal live app
      window.revealLiveApp = () => {
        const overlay = document.getElementById('fullMotionOverlay');
        if (overlay) {
          overlay.style.opacity = '0';
          overlay.style.transform = 'scale(1.05)';
          overlay.style.pointerEvents = 'none';
          setTimeout(() => {
            overlay.style.display = 'none';
          }, 800);
        }
      };

      // Function to show Outro Motion Card in Scene 8
      window.renderMotionScene8 = () => {
        const overlay = document.getElementById('fullMotionOverlay');
        if (overlay) {
          overlay.style.display = 'flex';
          overlay.style.opacity = '1';
          overlay.style.transform = 'scale(1)';
          overlay.style.pointerEvents = 'all';
          const c = document.getElementById('motionCardContent');
          c.innerHTML = `
            <div style="display:flex; align-items:center; gap:12px; margin-bottom:20px;">
              <span style="background:rgba(234, 88, 12, 0.15); border:1.5px solid #EA580C; color:#EA580C; padding:6px 16px; border-radius:999px; font-size:14px; font-weight:800; letter-spacing:0.08em; text-transform:uppercase;">
                GENLAYER STUDIONET (CHAIN 61999)
              </span>
            </div>

            <h1 style="font-size:64px; font-weight:900; letter-spacing:-0.03em; color:#FFFFFF; margin:0 0 16px 0; text-align:center;">
              ROAST<span style="color:#EA580C;">WARS</span>
            </h1>
            <p style="font-size:24px; color:#CBD5E1; margin:0 0 44px 0; text-align:center; max-width:850px; font-weight:600;">
              The Autonomous On-Chain AI Comedy Arena
            </p>

            <div style="background:rgba(30, 41, 59, 0.95); border:2.5px solid #EA580C; border-radius:24px; padding:40px 60px; box-shadow:0 25px 50px rgba(0,0,0,0.8), 0 0 40px rgba(234, 88, 12, 0.25); text-align:center; max-width:800px; width:100%;">
              <div style="font-size:20px; font-weight:800; color:#38BDF8; margin-bottom:12px; letter-spacing:0.04em;">PLAY LIVE TODAY</div>
              <div style="font-size:38px; font-weight:900; color:#FFFFFF; letter-spacing:-0.02em; margin-bottom:24px; font-family:'Space Grotesk', sans-serif;">
                roastwar.vercel.app
              </div>

              <div style="display:flex; align-items:center; justify-content:center; gap:24px; padding-top:20px; border-top:1px solid #334155;">
                <span style="color:#94A3B8; font-size:16px; font-weight:600;">Open Source on GitHub: <strong style="color:#FFFFFF;">AshThunder/roastwar</strong></span>
                <span style="color:#94A3B8; font-size:16px;">•</span>
                <span style="color:#10B981; font-size:16px; font-weight:700;">Zero Gas Escrow</span>
              </div>
            </div>
          `;
        }
      };
    });

    // ─────────────────────────────────────────────────────────────
    // SCENE 1: Motion Graphic — Traditional vs Intelligent Contracts
    // Duration: 18.0s (Cue 0: 0.8s - 17.6s)
    // ─────────────────────────────────────────────────────────────
    console.log('Rendering Scene 1: Motion Graphic — Traditional vs Intelligent Contracts (18.0s)...');
    await page.evaluate(() => {
      window.renderMotionScene1();
      window.setSubtitle('ROASTWARS — WHERE PUNCHLINES MEET ON-CHAIN CONSENSUS', '#EA580C');
    });
    await holdScene(18.0);

    // ─────────────────────────────────────────────────────────────
    // SCENE 2: Motion Graphic — The AI Consensus Engine
    // Duration: 14.5s (Cue 1: 19.0s - 32.34s)
    // ─────────────────────────────────────────────────────────────
    console.log('Rendering Scene 2: Motion Graphic — The AI Consensus Engine (14.5s)...');
    await page.evaluate(() => {
      window.renderMotionScene2();
      window.setSubtitle('5-VALIDATOR AI CONSENSUS: gl.vm.run_nondet_unsafe', '#38BDF8');
    });
    await holdScene(14.5);

    // ─────────────────────────────────────────────────────────────
    // SCENE 3: UI Walkthrough — The Arena Lobby & Escrow
    // Duration: 14.0s (Cue 2: 33.74s - 46.27s)
    // ─────────────────────────────────────────────────────────────
    console.log('Rendering Scene 3: UI Walkthrough — The Arena Lobby (14.0s)...');
    await page.evaluate(() => {
      window.revealLiveApp();
      window.setSubtitle('BATTLE ARENA LOBBY: 1-ON-1 WIT DUELS WITH ZERO GAS ESCROW', '#F59E0B');
    });
    // Smooth scroll down to arena lobby
    await smoothScroll(0, 560, 3.0);
    await holdScene(11.0);

    // ─────────────────────────────────────────────────────────────
    // SCENE 4: UI Walkthrough — Duel Modes & Punchlines
    // Duration: 12.0s (Cue 3: 47.67s - 58.11s)
    // ─────────────────────────────────────────────────────────────
    console.log('Rendering Scene 4: UI Walkthrough — Duel Modes & Punchlines (12.0s)...');
    await page.evaluate(() => {
      window.setSubtitle('DUEL MODES: VICIOUS ROASTS VS WHOLESOME COMPLIMENTS', '#10B981');
      const tabs = document.querySelectorAll('.tab-btn');
      tabs.forEach(t => {
        if (t.textContent.includes('OPEN')) t.click();
      });
    });
    await holdScene(4.0);

    await page.evaluate(() => {
      window.setSubtitle('FILTERING JUDGING CHAMBERS & RESOLVED DUELS', '#EA580C');
      const tabs = document.querySelectorAll('.tab-btn');
      tabs.forEach(t => {
        if (t.textContent.includes('JUDGING')) t.click();
      });
    });
    await holdScene(4.0);

    await page.evaluate(() => {
      const tabs = document.querySelectorAll('.tab-btn');
      tabs.forEach(t => {
        if (t.textContent.includes('ALL DUELS')) t.click();
      });
    });
    await holdScene(4.0);

    // ─────────────────────────────────────────────────────────────
    // SCENE 5: UI Walkthrough — AI Jury Chamber Deliberation
    // Duration: 15.0s (Cue 4: 59.51s - 73.24s)
    // ─────────────────────────────────────────────────────────────
    console.log('Rendering Scene 5: UI Walkthrough — AI Jury Chamber Deliberation (15.0s)...');
    await page.evaluate(() => {
      window.setSubtitle('AI JURY CHAMBER: 5 VALIDATOR NODES DELIBERATE IN CONSENSUS', '#38BDF8');
      if (typeof openJuryModal === 'function') {
        openJuryModal(1);
      }
    });
    await holdScene(15.0);

    // ─────────────────────────────────────────────────────────────
    // SCENE 6: UI Walkthrough — Example Battle (Alice 9/10 Victor)
    // Duration: 14.5s (Cue 5: 74.64s - 87.74s)
    // ─────────────────────────────────────────────────────────────
    console.log('Rendering Scene 6: UI Walkthrough — Example Battle (Alice 9/10 Victor) (14.5s)...');
    await page.evaluate(() => {
      window.setSubtitle('EXAMPLE BATTLE: ALICE SCORES 9/10 & UNLOCKS 2X PRIZE POT', '#10B981');
    });
    await holdScene(14.5);

    // Close Modal
    await page.evaluate(() => {
      if (typeof closeJuryModal === 'function') {
        closeJuryModal();
      }
    });
    await holdScene(1.0);

    // ─────────────────────────────────────────────────────────────
    // SCENE 7: UI Walkthrough — Hall of Fame & Leaderboard
    // Duration: 17.5s (Cue 6: 89.14s - 105.51s)
    // ─────────────────────────────────────────────────────────────
    console.log('Rendering Scene 7: UI Walkthrough — Hall of Fame & Leaderboard (17.5s)...');
    await page.evaluate(() => {
      window.setSubtitle('HALL OF FAME & LEADERBOARD: IMMUTABLE WIN RATES & GEN VOLUME', '#F59E0B');
    });
    await smoothScroll(560, 1550, 3.5);
    await holdScene(7.0);

    // Scroll to architectural verification badge
    await page.evaluate(() => {
      window.setSubtitle('VERIFIED STUDIONET ARCHITECTURE: 8/8 PASSED TESTS • ZERO GAS', '#10B981');
    });
    await smoothScroll(1550, 2200, 3.0);
    await holdScene(4.0);

    // ─────────────────────────────────────────────────────────────
    // SCENE 8: Motion Graphic Outro & Call to Action
    // Duration: 14.0s (Cue 7: 106.91s - 117.71s + Outro)
    // ─────────────────────────────────────────────────────────────
    console.log('Rendering Scene 8: Motion Graphic Outro & Call to Action (14.0s)...');
    await page.evaluate(() => {
      window.renderMotionScene8();
      window.setSubtitle('PLAY LIVE NOW AT ROASTWAR.VERCEL.APP • OPEN SOURCE ON GITHUB', '#EA580C');
    });
    await holdScene(14.0);

    console.log(`Video visual frames recorded successfully! Total frames: ${frameCount}`);
  } catch (err) {
    console.error('Recording error:', err);
    throw err;
  } finally {
    ffmpeg.stdin.end();
    await browser.close();
  }

  // Wait for raw video packaging
  await new Promise((resolve) => {
    ffmpeg.on('close', (code) => {
      console.log(`Raw video packaging completed with exit code ${code}`);
      resolve();
    });
  });

  // Mux raw video with master broadcast audio
  console.log('Muxing raw video and master audio with ffmpeg...');
  const muxCmd = `/home/michael/.local/bin/ffmpeg -y -i ${RAW_VIDEO} -i ${AUDIO_FILE} -c:v copy -c:a copy -t ${timingData.total_duration} ${FINAL_VIDEO}`;
  const { execSync } = await import('child_process');
  execSync(muxCmd, { stdio: 'inherit' });
  console.log(`=== Demo Video Successfully Built: ${FINAL_VIDEO} ===`);
}

record().catch((err) => {
  console.error('Fatal error during recording:', err);
  process.exit(1);
});
