import urllib.request
import urllib.parse
import os
import subprocess
import json

cues = [
    # (cue_idx, text)
    (0, "Traditional smart contracts can calculate balances, but they cannot judge wit. Welcome to RoastWars, the world's first autonomous comedy arena powered by GenLayer."),
    (1, "By running LLMs directly inside validator consensus, RoastWars brings subjective intelligence and comedic judgment fully on-chain."),
    (2, "In the arena lobby, contenders create or match one on one duels, staking native GEN tokens in a zero-gas escrow pot."),
    (3, "Whether trading vicious burns or wholesome compliments, both punchlines are securely locked into the contract."),
    (4, "When a duel closes, five independent validator nodes deliberate, scoring each line from zero to ten based on comedic timing and delivery."),
    (5, "In this example battle, Alice scores nine out of ten to claim victory, instantly unlocking the double prize pot directly to her wallet."),
    (6, "Every punchline, score, and payout is recorded immutably on-chain. Contenders climb the Hall of Fame to claim supremacy as the sharpest comedian on Web3."),
    (7, "Experience the future of intelligent contracts today. Connect and battle live at roastwar dot vercel dot app.")
]

ffmpeg_bin = "/home/michael/.local/bin/ffmpeg"
ffprobe_bin = "/home/michael/.local/bin/ffprobe"

temp_dir = "assets/vo_parts"
os.makedirs(temp_dir, exist_ok=True)

try:
    cue_info = []
    print("Downloading / synthesizing all 8 approved voice cues...")
    for idx, text in cues:
        fname = os.path.join(temp_dir, f"cue_{idx}.mp3")
        url = "https://translate.google.com/translate_tts?ie=UTF-8&tl=en&client=tw-ob&q=" + urllib.parse.quote(text)
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req) as resp, open(fname, "wb") as f:
            f.write(resp.read())
        
        probe = subprocess.check_output([ffprobe_bin, '-v', 'quiet', '-show_entries', 'format=duration', '-of', 'json', fname])
        dur = float(json.loads(probe)['format']['duration'])
        print(f"Cue {idx}: dur {dur:.2f}s | '{text[:40]}...'")
        cue_info.append({
            'idx': idx,
            'file': fname,
            'dur': dur,
            'text': text
        })

    # Now calculate start timestamps with generous, guaranteed positive silence gaps
    # Desired scene progression:
    # Scene 1 (Motion: Problem & Intro): Cue 0
    # Scene 2 (Motion: AI Consensus Engine): Cue 1
    # Scene 3 (UI: Lobby & Escrow): Cue 2
    # Scene 4 (UI: Modes & Punchlines): Cue 3
    # Scene 5 (UI + Modal: 5-Validator Deliberation): Cue 4
    # Scene 6 (UI + Modal: Example Verdict Alice 9/10): Cue 5
    # Scene 7 (UI: Hall of Fame & Leaderboard): Cue 6
    # Scene 8 (Motion: Outro & Call to Action): Cue 7

    start_times = []
    current_time = 0.8  # Start first cue at 0.8s into the video

    for i, c in enumerate(cue_info):
        gap = 1.4  # 1.4s of clean silence between every cue
        if i == 0:
            c_start = 0.8
        else:
            prev_end = start_times[i-1] + cue_info[i-1]['dur']
            c_start = round(prev_end + gap, 2)
        start_times.append(c_start)
        c['start'] = c_start
        c['end'] = round(c_start + c['dur'], 2)

    total_duration = round(cue_info[-1]['end'] + 2.8, 1) # 2.8s outro music margin

    print("\n--- TIMING SCHEDULE & VERIFICATION ---")
    for i, c in enumerate(cue_info):
        print(f"Scene {i+1} [Cue {i}]: starts {c['start']:6.2f}s, dur {c['dur']:5.2f}s, ends {c['end']:6.2f}s")
        if i > 0:
            gap = c['start'] - cue_info[i-1]['end']
            print(f"   -> Gap from previous: {gap:4.2f}s clean silence")
            assert gap >= 0.8, f"Overlap detected between Cue {i-1} and Cue {i}!"

    print(f"\nTotal video target duration: {total_duration}s")

    # Export timing metadata to JSON so recording script can sync perfectly
    with open("assets/demo_timing.json", "w") as f:
        json.dump({
            'total_duration': total_duration,
            'cues': cue_info
        }, f, indent=2)
    print("Saved timing plan to assets/demo_timing.json")

    # Build audio filter complex
    filter_inputs = ""
    filter_parts = []
    for i, c in enumerate(cue_info):
        filter_inputs += f"-i {c['file']} "
        ms_delay = int(c['start'] * 1000)
        filter_parts.append(f"[{i}:a]adelay={ms_delay}|{ms_delay}[a{i}];")
    
    amix_inputs = "".join([f"[a{i}]" for i in range(len(cue_info))])
    
    # We create the master voice track with loudnorm and volume boost
    cmd = (
        f"{ffmpeg_bin} -y {filter_inputs} "
        f"-filter_complex \"{''.join(filter_parts)}"
        f"{amix_inputs}amix=inputs={len(cue_info)}:normalize=0,"
        f"highpass=f=90,lowpass=f=8500,"
        f"loudnorm=I=-12:TP=-0.5:LRA=6,volume=2.2[voice]\" "
        f"-map \"[voice]\" assets/voiceover_master.wav"
    )
    print("\nAssembling master voice track with broadcast loudness normalization...")
    subprocess.run(cmd, shell=True, check=True)
    print("Voiceover master created at assets/voiceover_master.wav")

    # Now mix with gentle ambient synth pad
    pad_cmd = (
        f"{ffmpeg_bin} -y -i assets/voiceover_master.wav "
        f"-f lavfi -t {total_duration} -i \"aevalsrc=exprs='0.02*sin(2*PI*130.81*t)+0.015*sin(2*PI*164.81*t)+0.015*sin(2*PI*196.00*t)+0.01*sin(2*PI*261.63*t)':s=44100\" "
        f"-filter_complex \""
        f"[1:a]lowpass=f=500,afade=t=in:ss=0:d=2.0,afade=t=out:st={total_duration-3.0}:d=2.8,volume=0.032[pad];"
        f"[0:a][pad]amix=inputs=2:normalize=0:duration=longest[aout]\" "
        f"-map \"[aout]\" -c:a aac -b:a 192k assets/audio_master.aac"
    )
    print("\nMixing ambient background chords underneath voiceover...")
    subprocess.run(pad_cmd, shell=True, check=True)
    print("Audio master ready at assets/audio_master.aac!")

except Exception as e:
    print(f"Error building voiceover: {e}")
    raise
