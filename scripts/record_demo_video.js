import puppeteer from 'puppeteer-core';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

const OUTPUT_VIDEO = path.resolve('assets/roastwars_demo.mp4');
const LIVE_URL = 'https://roastwar.vercel.app/';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function record() {
  console.log('Starting RoastWars Motion Design Demo Video Recording...');
  console.log(`Target URL: ${LIVE_URL}`);
  console.log(`Output Video: ${OUTPUT_VIDEO}`);

  // Ensure assets directory exists
  if (!fs.existsSync('assets')) {
    fs.mkdirSync('assets', { recursive: true });
  }

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

  // Spawn ffmpeg process to record frames from stdin
  const ffmpeg = spawn('/home/michael/.local/bin/ffmpeg', [
    '-y',
    '-f', 'image2pipe',
    '-vcodec', 'mjpeg',
    '-r', '20',
    '-i', '-',
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-preset', 'fast',
    '-crf', '20',
    OUTPUT_VIDEO
  ]);

  ffmpeg.stderr.on('data', (d) => {
    // Suppress verbose logs, only show errors
    const str = d.toString();
    if (str.includes('Error') || str.includes('fatal')) {
      console.error('FFMPEG:', str);
    }
  });

  let frameCount = 0;
  async function recordFrame() {
    const buf = await page.screenshot({ type: 'jpeg', quality: 92 });
    ffmpeg.stdin.write(buf);
    frameCount++;
  }

  async function holdScene(seconds) {
    const count = Math.round(seconds * 20);
    for (let i = 0; i < count; i++) {
      await recordFrame();
      await sleep(15);
    }
  }

  async function smoothScroll(fromY, toY, seconds) {
    const totalFrames = Math.round(seconds * 20);
    for (let i = 0; i <= totalFrames; i++) {
      const progress = i / totalFrames;
      // Ease in-out cubic
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
    console.log('Loading page...');
    await page.goto(LIVE_URL, { waitUntil: 'networkidle2', timeout: 30000 });

    // Inject sleek motion design subtitle / caption overlay
    await page.evaluate(() => {
      const overlay = document.createElement('div');
      overlay.id = 'motionSubtitleBar';
      overlay.style.position = 'fixed';
      overlay.style.bottom = '28px';
      overlay.style.left = '50%';
      overlay.style.transform = 'translateX(-50%)';
      overlay.style.background = '#1E293B';
      overlay.style.color = '#FFFFFF';
      overlay.style.border = '3px solid #EA580C';
      overlay.style.boxShadow = '6px 6px 0px #000000';
      overlay.style.padding = '12px 28px';
      overlay.style.fontFamily = "'Space Grotesk', sans-serif";
      overlay.style.fontSize = '18px';
      overlay.style.fontWeight = '800';
      overlay.style.letterSpacing = '-0.02em';
      overlay.style.textTransform = 'uppercase';
      overlay.style.zIndex = '999999';
      overlay.style.display = 'flex';
      overlay.style.alignItems = 'center';
      overlay.style.gap = '14px';
      overlay.style.transition = 'all 0.3s ease';
      overlay.innerHTML = `
        <span style="display:inline-block; width:10px; height:10px; background:#10B981; border-radius:50%; box-shadow:0 0 10px #10B981;"></span>
        <span id="motionSubText">ROASTWARS — AUTONOMOUS ON-CHAIN AI COMEDY ARENA</span>
      `;
      document.body.appendChild(overlay);

      window.setSubtitle = (text, dotColor = '#10B981') => {
        const el = document.getElementById('motionSubText');
        const bar = document.getElementById('motionSubtitleBar');
        if (el) el.textContent = text;
        if (bar) {
          const dot = bar.querySelector('span:first-child');
          if (dot) {
            dot.style.background = dotColor;
            dot.style.boxShadow = `0 0 10px ${dotColor}`;
          }
        }
      };
    });

    console.log('Scene 1: Cold Open & Hero Overview...');
    await page.evaluate(() => window.setSubtitle('ROASTWARS — WHERE PUNCHLINES MEET ON-CHAIN CONSENSUS', '#EA580C'));
    await holdScene(3.5);

    console.log('Scene 2: Core Concept & Live Stats...');
    await page.evaluate(() => window.setSubtitle('POWERED BY GENLAYER INTELLIGENT CONTRACTS ON STUDIONET (CHAIN 61999)', '#F59E0B'));
    await holdScene(3.0);

    console.log('Scene 3: Smooth Scroll to Battle Arena Lobby...');
    await page.evaluate(() => window.setSubtitle('BATTLE ARENA LOBBY: 1-ON-1 WIT DUELS WITH ZERO GAS ESCROW', '#38BDF8'));
    await smoothScroll(0, 560, 2.5);
    await holdScene(2.0);

    console.log('Scene 4: Filter Showcases (Open Challenges)...');
    await page.evaluate(() => {
      window.setSubtitle('FILTER: OPEN CHALLENGES AWAITING CONTENDERS (0.25 GEN STAKE)', '#F59E0B');
      const tabs = document.querySelectorAll('.tab-btn');
      tabs.forEach(t => {
        if (t.textContent.includes('OPEN')) t.click();
      });
    });
    await holdScene(3.0);

    console.log('Scene 5: Filter Showcases (Judging Chamber)...');
    await page.evaluate(() => {
      window.setSubtitle('FILTER: JUDGING CHAMBER — AWAITING 5-VALIDATOR AI CONSENSUS', '#EA580C');
      const tabs = document.querySelectorAll('.tab-btn');
      tabs.forEach(t => {
        if (t.textContent.includes('JUDGING')) t.click();
      });
    });
    await holdScene(3.0);

    console.log('Scene 6: Filter Showcases (Hall of Fame)...');
    await page.evaluate(() => {
      window.setSubtitle('FILTER: HALL OF FAME — RESOLVED DUELS WITH 2X POT PAYOUTS', '#10B981');
      const tabs = document.querySelectorAll('.tab-btn');
      tabs.forEach(t => {
        if (t.textContent.includes('HALL OF FAME')) t.click();
      });
    });
    await holdScene(3.0);

    console.log('Scene 7: Return to All Duels & Open Jury Modal...');
    await page.evaluate(() => {
      window.setSubtitle('OPENING AI JURY CHAMBER FOR BATTLE #1: AI CODING ASSISTANTS', '#EA580C');
      const tabs = document.querySelectorAll('.tab-btn');
      tabs.forEach(t => {
        if (t.textContent.includes('ALL DUELS')) t.click();
      });
    });
    await holdScene(1.5);

    // Open Jury Modal on Battle #1
    await page.evaluate(() => {
      if (typeof openJuryModal === 'function') {
        openJuryModal(1);
      }
    });
    await holdScene(1.0);

    console.log('Scene 8: AI Jury Chamber Deliberation Reveal...');
    await page.evaluate(() => window.setSubtitle('5 VALIDATOR NODES EXECUTE gl.vm.run_nondet_unsafe EQUIVALENCE CONSENSUS', '#38BDF8'));
    await holdScene(3.5);

    await page.evaluate(() => window.setSubtitle('AI SCORES PUNCHLINES 0-10 & CROWNS ALICE THE SAVAGE VICTOR (9/10)', '#10B981'));
    await holdScene(3.5);

    // Close Modal
    await page.evaluate(() => {
      if (typeof closeJuryModal === 'function') {
        closeJuryModal();
      }
    });
    await holdScene(1.5);

    console.log('Scene 9: Scroll to Hall of Fame & Leaderboard...');
    await page.evaluate(() => window.setSubtitle('HALL OF FAME & LEADERBOARD: TOP COMEDIANS, WIN RATES, & GEN VOLUME', '#F59E0B'));
    await smoothScroll(560, 1550, 2.5);
    await holdScene(3.5);

    console.log('Scene 10: Scroll to Architectural Explainers...');
    await page.evaluate(() => window.setSubtitle('VERIFIED STUDIONET ARCHITECTURE: 8/8 PASSED TESTS • ZERO GAS ESCROW', '#10B981'));
    await smoothScroll(1550, 2200, 2.5);
    await holdScene(3.5);

    console.log('Scene 11: Outro & Live Vercel Link...');
    await page.evaluate(() => window.setSubtitle('PLAY NOW AT ROASTWAR.VERCEL.APP • OPEN SOURCE ON GITHUB', '#EA580C'));
    await smoothScroll(2200, 0, 3.0);
    await holdScene(3.5);

    console.log(`Recording complete! Total frames recorded: ${frameCount}`);
  } catch (err) {
    console.error('Recording error:', err);
  } finally {
    ffmpeg.stdin.end();
    await browser.close();
  }

  // Wait for ffmpeg to finish packaging
  await new Promise((resolve) => {
    ffmpeg.on('close', (code) => {
      console.log(`FFMPEG process exited with code ${code}`);
      resolve();
    });
  });

  const stats = fs.statSync(OUTPUT_VIDEO);
  console.log(`Demo video successfully generated: ${OUTPUT_VIDEO} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
}

record().catch(console.error);
