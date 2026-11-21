"""
Clipwave audio feature extractor.

Reads a mono 16 kHz float32 PCM file (produced with ffmpeg) and returns
per-window acoustic features used by the moment detector: loudness (RMS),
zero-crossing rate, spectral centroid, spectral flux (onset/excitement),
pitch proxy, and silence ratio.

  python3 python/audio_features.py --pcm audio.f32 --out features.json --window 0.5
"""
import argparse
import json
import sys

import numpy as np


def extract(path, sr=16000, window=0.5):
    audio = np.fromfile(path, dtype=np.float32)
    if audio.size == 0:
        return {"sr": sr, "window": window, "frames": [], "duration": 0.0}

    hop = int(sr * window)
    n = int(np.ceil(len(audio) / hop))
    padded = np.zeros(n * hop, dtype=np.float32)
    padded[: len(audio)] = audio
    frames = padded.reshape(n, hop)

    rms = np.sqrt(np.mean(frames**2, axis=1) + 1e-12)
    zcr = np.mean(np.abs(np.diff(np.sign(frames), axis=1)) > 0, axis=1)

    # Hann-windowed magnitude spectra
    spec = np.abs(np.fft.rfft(frames * np.hanning(hop), axis=1)) + 1e-9
    freqs = np.fft.rfftfreq(hop, 1 / sr)
    centroid = (spec * freqs).sum(axis=1) / spec.sum(axis=1)

    # Spectral flux: frame-to-frame increase in magnitude (onset strength)
    flux = np.zeros(n)
    flux[1:] = np.mean(np.maximum(0, np.diff(spec, axis=0)), axis=1)
    if flux.max() > 0:
        flux = flux / flux.max()

    # Pitch proxy: dominant non-DC frequency bin per frame within 70–400 Hz
    band = (freqs >= 70) & (freqs <= 400)
    pitch = freqs[band][np.argmax(spec[:, band], axis=1)] if band.any() else np.zeros(n)

    rms_db = 20 * np.log10(rms + 1e-9)
    speech_threshold = np.percentile(rms_db, 35) + 3
    is_speech = rms_db > speech_threshold

    out = []
    for i in range(n):
        out.append(
            {
                "t": round(i * window, 2),
                "rms": round(float(rms[i]), 5),
                "rmsDb": round(float(rms_db[i]), 2),
                "zcr": round(float(zcr[i]), 4),
                "centroid": round(float(centroid[i]), 1),
                "flux": round(float(flux[i]), 4),
                "pitch": round(float(pitch[i]), 1),
                "speech": bool(is_speech[i]),
            }
        )

    return {
        "sr": sr,
        "window": window,
        "duration": round(len(audio) / sr, 2),
        "frames": out,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pcm", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--window", type=float, default=0.5)
    args = ap.parse_args()
    try:
        data = extract(args.pcm, window=args.window)
    except Exception as exc:
        print(json.dumps({"error": str(exc)}))
        sys.exit(3)
    with open(args.out, "w", encoding="utf-8") as fh:
        json.dump(data, fh)
    print(json.dumps({"ok": True, "frames": len(data["frames"]), "duration": data["duration"]}))


if __name__ == "__main__":
    main()
