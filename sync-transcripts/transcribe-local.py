#!/usr/bin/env python3
"""Local transcription via Parakeet TDT (MLX) — free, no Deepgram credits.

Usage: python3 transcribe-local.py <session_folder>

Finds the audio file in the folder (mp3/wav/m4a/mp4), transcribes with
mlx-community/parakeet-tdt-0.6b-v3, and writes transcript.json in the
convert.ts format. No speaker diarization: all words are channel 0
(convert.ts then labels turns "Speaker" instead of "Me"/"Other").
"""

import json
import re
import sys
import time
from pathlib import Path

from parakeet_mlx.parakeet import DecodingConfig
from parakeet_mlx.utils import from_pretrained

MODEL = "mlx-community/parakeet-tdt-0.6b-v3"


def find_audio(folder: Path) -> Path | None:
    for name in ["audio.mp3", "audio.wav", "audio.m4a"]:
        p = folder / name
        if p.exists():
            return p
    files = [f for f in folder.iterdir() if f.is_file()]
    for pat in [
        r"^audio_only.*\.(m4a|mp3|wav)$",
        r"^audio.*\.(m4a|mp3|wav|mp4)$",
        r"^video.*\.(mp4|mov|m4v)$",
    ]:
        matches = sorted(f for f in files if re.match(pat, f.name, re.I))
        if matches:
            return matches[0]
    return None


def main() -> int:
    if len(sys.argv) < 2:
        print("Usage: python3 transcribe-local.py <session_folder>", file=sys.stderr)
        return 1

    folder = Path(sys.argv[1])
    audio = find_audio(folder)
    if audio is None:
        print(f"No audio file found in {folder}", file=sys.stderr)
        return 1

    transcript_path = folder / "transcript.json"
    if transcript_path.exists():
        print("transcript.json already exists, skipping")
        return 0

    print("Loading Parakeet TDT model...")
    model = from_pretrained(MODEL)

    print(f"Transcribing {audio.name}...")
    t0 = time.time()
    result = model.transcribe(str(audio), chunk_duration=30.0)
    print(f"Done in {time.time() - t0:.1f}s ({len(result.sentences)} sentences)")

    # Sentence-level words (parakeet token stream is subword; sentences are clean)
    words = [
        {
            "channel": 0,
            "start_ms": int(s.start * 1000),
            "end_ms": int(s.end * 1000),
            "text": " " + s.text,
        }
        for s in result.sentences
    ]
    if len(words) == 0:
        print("Transcription returned no sentences", file=sys.stderr)
        return 1

    transcript_path.write_text(
        json.dumps({"transcripts": [{"words": words}]}, ensure_ascii=False, indent=2) + "\n",
        "utf-8",
    )
    print(f"Saved transcript.json ({len(words)} sentence-words)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
