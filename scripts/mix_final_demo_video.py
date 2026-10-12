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

ffmpeg_bin = "/home/michael/.local/bin/ffmpeg"
ffprobe_bin = "/home/michael/.local/bin/ffprobe"

temp_files = []
try:
    print("Synthesizing clear voice cues...")
    for idx, (ts, text) in enumerate(cues):
        fname = f"assets/part_{idx}.mp3"
        url = "https://translate.google.com/translate_tts?ie=UTF-8&tl=en&client=tw-ob&q=" + urllib.parse.quote(text)
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req) as resp, open(fname, "wb") as f:
            f.write(resp.read())
        
        probe = subprocess.check_output([ffprobe_bin, '-v', 'quiet', '-show_entries', 'format=duration', '-of', 'json', fname])
        dur = float(json.loads(probe)['format']['duration'])
        print(f"Cue {idx}: starts at {ts:.1f}s, duration {dur:.2f}s, ends at {ts+dur:.2f}s | '{text}'")
        temp_files.append((ts, fname, dur))

    # Verify no overlaps with assertion
    print("\nVerifying cue separation:")
    for i in range(len(temp_files) - 1):
        end_current = temp_files[i][0] + temp_files[i][2]
        start_next = temp_files[i+1][0]
        gap = start_next - end_current
        assert gap > 0.3, f"Overlap or too small gap between Cue {i} and Cue {i+1}: {gap:.2f}s"
        print(f"  Verified: Gap of {gap:.2f}s between Cue {i} and Cue {i+1} (clean silence).")

    last_end = temp_files[-1][0] + temp_files[-1][2]
    print(f"Final cue concludes at {last_end:.2f}s. Clean outro music margin: {49.70 - last_end:.2f}s.\n")

    # Build filter complex for voice assembly with adelay
    filter_inputs = ""
    filter_parts = []
    for i, (ts, fn, _) in enumerate(temp_files):
        filter_inputs += f"-i {fn} "
        ms_delay = int(ts * 1000)
        filter_parts.append(f"[{i+1}:a]adelay={ms_delay}|{ms_delay}[a{i}];")
    
    amix_inputs = "".join([f"[a{i}]" for i in range(len(temp_files))])
    
    # Mix into video:
    # Input 0: assets/roastwars_demo.mp4 (49.70s video)
    # Inputs 1..7: voice cue mp3s
    # Input 8: lavfi soft ambient pad chord (49.70s)
    #
    # Audio chain:
    # 1. adelay on each cue
    # 2. amix=normalize=0 so amplitudes are NOT divided
    # 3. loudnorm to broadcast loudness (I=-12 LUFS, TP=-0.5dB) + volume boost (2.2x)
    # 4. gentle warm ambient synth pad underneath at volume=0.035
    # 5. duration=longest with -t 49.7 to retain full video duration and smooth audio fade out
    cmd = (
        f"{ffmpeg_bin} -y -i assets/roastwars_demo.mp4 {filter_inputs} "
        f"-f lavfi -t 49.7 -i \"aevalsrc=exprs='0.02*sin(2*PI*130.81*t)+0.015*sin(2*PI*164.81*t)+0.015*sin(2*PI*196.00*t)+0.01*sin(2*PI*261.63*t)':s=44100\" "
        f"-filter_complex \"{''.join(filter_parts)}"
        f"{amix_inputs}amix=inputs={len(temp_files)}:normalize=0,"
        f"highpass=f=90,lowpass=f=8500,"
        f"loudnorm=I=-12:TP=-0.5:LRA=6,volume=2.2[voice];"
        f"[8:a]lowpass=f=500,afade=t=in:ss=0:d=2.0,afade=t=out:st=47.0:d=2.7,volume=0.035[pad];"
        f"[voice][pad]amix=inputs=2:normalize=0:duration=longest[aout]\" "
        f"-map 0:v -map \"[aout]\" "
        f"-c:v copy -c:a aac -b:a 192k -t 49.7 "
        f"assets/roastwars_demo_clean.mp4"
    )

    print("Running ffmpeg master assemble...")
    subprocess.run(cmd, shell=True, check=True)
    print("Assembly successful! Replacing assets/roastwars_demo.mp4...")
    os.replace("assets/roastwars_demo_clean.mp4", "assets/roastwars_demo.mp4")
    print("Demo video successfully updated with clean, loud, non-overlapping voiceover!")

finally:
    for _, fn, _ in temp_files:
        if os.path.exists(fn):
            os.remove(fn)
