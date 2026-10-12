import urllib.request
import urllib.parse
import os
import subprocess
import json

cues = [
    (0.8, "Welcome to RoastWars, where punchlines meet consensus."),
    (7.5, "Comedians wager GEN tokens in battles of wit."),
    (14.0, "Browse open challenges, judging chambers, or past battles."),
    (21.2, "Validator nodes deliberate in consensus, crowning Alice victorious."),
    (29.0, "Alice scores nine out of ten, claiming the double prize pot."),
    (36.0, "Track player rankings and total earnings on-chain."),
    (42.5, "Play live now at roastwar dot vercel dot app.")
]

temp_files = []
ffmpeg_bin = "/home/michael/.local/bin/ffmpeg"
ffprobe_bin = "/home/michael/.local/bin/ffprobe"

try:
    for idx, (ts, text) in enumerate(cues):
        fname = f"assets/part_{idx}.mp3"
        url = "https://translate.google.com/translate_tts?ie=UTF-8&tl=en&client=tw-ob&q=" + urllib.parse.quote(text)
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req) as resp, open(fname, "wb") as f:
            f.write(resp.read())
        
        probe = subprocess.check_output([ffprobe_bin, '-v', 'quiet', '-show_entries', 'format=duration', '-of', 'json', fname])
        dur = float(json.loads(probe)['format']['duration'])
        print(f"Cue {idx}: starts at {ts:.1f}s, duration {dur:.2f}s, ends at {ts+dur:.2f}s")
        temp_files.append((ts, fname, dur))

    filter_inputs = ""
    filter_parts = []
    for i, (ts, fn, _) in enumerate(temp_files):
        filter_inputs += f"-i {fn} "
        ms_delay = int(ts * 1000)
        filter_parts.append(f"[{i}:a]adelay={ms_delay}|{ms_delay}[a{i}];")
    
    amix_inputs = "".join([f"[a{i}]" for i in range(len(temp_files))])
    filter_cmd = (
        f"{''.join(filter_parts)}{amix_inputs}amix=inputs={len(temp_files)}:normalize=0,"
        f"highpass=f=90,lowpass=f=8500,loudnorm=I=-12:TP=-0.5:LRA=6,volume=2.2[voice]"
    )

    cmd = (
        f"{ffmpeg_bin} -y {filter_inputs} "
        f"-filter_complex \"{filter_cmd}\" "
        f"-map \"[voice]\" assets/voiceover_clean.mp3"
    )
    print("Running ffmpeg voiceover assembly...")
    subprocess.run(cmd, shell=True, check=True)
    print("Clean voiceover assembled successfully at assets/voiceover_clean.mp3")

finally:
    for _, fn, _ in temp_files:
        if os.path.exists(fn):
            os.remove(fn)

print("Done generating clean, non-overlapping voiceover.")
