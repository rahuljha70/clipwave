"""
Clipwave STT worker — faster-whisper transcription with word timestamps,
speaker-turn detection and language identification.

Invoked by the Node worker:
  python3 python/transcribe.py --wav audio.wav --out transcript.json \
      --model small --device cpu --compute-type int8 --language auto

Emits JSON:
  { language, languageProbability, duration, words: [...], segments: [...] }
"""
import argparse
import json
import os
import sys


def group_speakers(words, max_gap=0.65, pitch_jump=0.0):
    """Cheap speaker-turn heuristic: a long pause or a clear prosody shift starts a
    new turn. Not full diarization — enough to tag "Speaker 1/2" captions."""
    speaker = 0
    prev_end = None
    for w in words:
        if prev_end is not None:
            gap = w["start"] - prev_end
            if gap > max_gap:
                speaker = (speaker + 1) % 2
        w["speaker"] = speaker
        prev_end = w["end"]
    return words


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--wav", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--model", default=os.environ.get("WHISPER_MODEL", "small"))
    ap.add_argument("--device", default=os.environ.get("WHISPER_DEVICE", "cpu"))
    ap.add_argument("--compute-type", default=os.environ.get("WHISPER_COMPUTE_TYPE", "int8"))
    ap.add_argument("--language", default="auto")
    ap.add_argument("--vad", action="store_true", default=True)
    args = ap.parse_args()

    try:
        import numpy as np
        from faster_whisper import WhisperModel
    except Exception as exc:  # pragma: no cover
        print(json.dumps({"error": f"faster-whisper is not installed: {exc}"}))
        sys.exit(3)

    # Decode with ffmpeg-free path: caller already produced 16k mono WAV.
    import wave

    with wave.open(args.wav, "rb") as wf:
        frames = wf.readframes(wf.getnframes())
        audio = np.frombuffer(frames, dtype=np.int16).astype(np.float32) / 32768.0

    model = WhisperModel(args.model, device=args.device, compute_type=args.compute_type)
    language = None if args.language in ("auto", "", None) else args.language
    segments_iter, info = model.transcribe(
        audio,
        language=language,
        word_timestamps=True,
        vad_filter=args.vad,
        vad_parameters={"min_silence_duration_ms": 400},
        beam_size=5,
        condition_on_previous_text=False,
    )

    words = []
    segments = []
    for seg in segments_iter:
        seg_words = []
        for w in (seg.words or []):
            word = w.word.strip()
            if not word:
                continue
            entry = {
                "start": round(float(w.start), 3),
                "end": round(float(w.end), 3),
                "word": word,
                "probability": round(float(getattr(w, "probability", 1.0) or 1.0), 3),
            }
            words.append(entry)
            seg_words.append(word)
        text = "".join(seg_words) if seg_words else (seg.text or "").strip()
        if text.strip():
            segments.append(
                {
                    "start": round(float(seg.start), 3),
                    "end": round(float(seg.end), 3),
                    "text": " ".join(seg_words) if seg_words else text.strip(),
                }
            )

    words = group_speakers(words)
    for seg in segments:
        for w in words:
            if w["start"] >= seg["start"] - 0.01 and w["start"] <= seg["end"] + 0.01:
                seg["speaker"] = w.get("speaker", 0)
                break

    payload = {
        "language": info.language or "en",
        "languageProbability": round(float(info.language_probability or 0), 3),
        "duration": round(float(info.duration or 0), 2),
        "words": words,
        "segments": segments,
    }
    with open(args.out, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False)
    print(json.dumps({"ok": True, "words": len(words), "language": payload["language"]}))


if __name__ == "__main__":
    main()
