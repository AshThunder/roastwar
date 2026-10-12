import urllib.request
import urllib.parse
import os
import subprocess

# Scene lines with target start timestamps in seconds
cues = [
    (0.8, "Welcome to RoastWars. The world's first autonomous on-chain comedy arena, where punchlines meet consensus."),
    (7.5, "Powered by GenLayer StudioNet, RoastWars runs intelligent contracts that bring large language models directly into validator consensus."),
    (15.5, "In the battle arena lobby, contenders wager native GEN tokens in one on one battles of wit. Browse open challenges, or match a rival's stake in zero-gas escrow."),
    (24.0, "Filter seamlessly across open challenges, active judging chambers, or the hall of fame."),
    (31.0, "When a duel concludes, five independent validator nodes evaluate punchlines with strict comedic rubrics. Alice The Savage scores nine out of ten, claiming the double prize pot."),
    (40.5, "Explore the leaderboard to track win rates, high scores, and total earnings, all verified on-chain."),
    (45.5, "Experience the future of intelligent contracts live today at roastwar dot vercel dot app.")
]

temp_files = []
try:
    for idx, (ts, text) in enumerate(cues):
        fname = f"assets/part_{idx}.mp3"
        url = "https://translate.google.com/translate_tts?ie=UTF-8&tl=en&client=tw-ob&q=" + urllib.parse.quote(text)
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req) as resp, open(fname, "wb") as f:
            f.write(resp.read())
        temp_files.append((ts, fname))
        print(f"Downloaded cue {idx} ({ts}s): {text[:40]}...")

    # Build ffmpeg filter_complex to place each clip at its exact timestamp
    filter_inputs = ""
    filter_parts = []
    for i, (ts, fn) in enumerate(temp_files):
        filter_inputs += f"-i {fn} "
        ms_delay = int(ts * 1000)
        filter_parts.append(f"[{i}:a]adelay={ms_delay}|{ms_delay}[a{i}];")
    
    amix_inputs = "".join([f"[a{i}]" for i in range(len(temp_files))])
    filter_cmd = f"{''.join(filter_parts)}{amix_inputs}amix=inputs={len(temp_files)}:dropout_transition=2,volume=1.4[voice]"

    ffmpeg_bin = "/home/michael/.local/bin/ffmpeg"
    cmd = (
        f"{ffmpeg_bin} -y {filter_inputs} "
        f"-filter_complex \"{filter_cmd}\" "
        f"-map \"[voice]\" assets/voiceover_raw.mp3"
    )
    print("Running ffmpeg assembly...")
    subprocess.run(cmd, shell=True, check=True)
    print("Voiceover assembled successfully at assets/voiceover_raw.mp3")

finally:
    for _, fn in temp_files:
        if os.path.exists(fn):
            os.remove(fn)

print("Temporary cue files cleaned up.")
