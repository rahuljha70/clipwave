"""
Clipwave face/speaker tracker for 9:16 auto-reframing.

Given a folder of sampled JPEG frames (ordered by time) it returns a smoothed
normalised horizontal centre for each sample, so the renderer can pan the
vertical crop window towards the speaker instead of hard-centring.

  python3 python/face_track.py --frames DIR --out track.json --every 1.0 --width 1080
"""
import argparse
import json
import os
import sys

import cv2
import numpy as np


def detect_centres(frame_paths):
    cascade = cv2.CascadeClassifier(
        os.path.join(cv2.data.haarcascades, "haarcascade_frontalface_default.xml")
    )
    profile = cv2.CascadeClassifier(
        os.path.join(cv2.data.haarcascades, "haarcascade_profileface.xml")
    )
    centres = []
    for path in frame_paths:
        img = cv2.imread(path)
        if img is None:
            centres.append(None)
            continue
        h, w = img.shape[:2]
        small_w = 360
        scale = small_w / w
        small = cv2.resize(img, (small_w, int(h * scale)))
        gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
        gray = cv2.equalizeHist(gray)
        faces = cascade.detectMultiScale(gray, scaleFactor=1.12, minNeighbors=4, minSize=(24, 24))
        if len(faces) == 0:
            faces = profile.detectMultiScale(gray, scaleFactor=1.12, minNeighbors=4, minSize=(24, 24))
        if len(faces) == 0:
            centres.append(None)
            continue
        # Prefer the largest (closest) face.
        x, y, fw, fh = max(faces, key=lambda f: f[2] * f[3])
        centres.append(((x + fw / 2) / small_w, (fw * fh) / (small_w * small.shape[0])))
    return centres


def smooth(values, alpha=0.35):
    out = []
    prev = None
    for v in values:
        if v is None:
            out.append(prev)
            continue
        prev = v if prev is None else prev + alpha * (v - prev)
        out.append(prev)
    # fill gaps at the start
    first = next((v for v in out if v is not None), None)
    return [first if v is None else v for v in out]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--frames", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--every", type=float, default=1.0)
    ap.add_argument("--width", type=int, default=1080)
    ap.add_argument("--source-width", type=int, default=1920)
    ap.add_argument("--max-segments", type=int, default=16)
    args = ap.parse_args()

    files = sorted(
        f for f in os.listdir(args.frames) if f.lower().endswith((".jpg", ".jpeg", ".png"))
    )
    paths = [os.path.join(args.frames, f) for f in files]
    if not paths:
        print(json.dumps({"error": "no frames"}))
        sys.exit(2)

    raw = detect_centres(paths)
    detected = sum(1 for c in raw if c is not None)
    centres = smooth([c[0] if c else None for c in raw])
    confidence = detected / len(raw)

    # Convert normalised centre -> pixel x origin for the crop window.
    src_w = args.source_width
    crop_w = int(round(args.width * 9 / 16)) if args.width else 1080
    points = []
    for i, c in enumerate(centres):
        t = round(i * args.every, 2)
        if c is None:
            points.append({"t": t, "x": None})
        else:
            points.append({"t": t, "x": round(c * src_w - crop_w / 2, 1)})

    # Simple decimation to keep the ffmpeg expression short.
    valid = [p for p in points if p["x"] is not None]
    if len(valid) > args.max_segments:
        step = len(valid) / args.max_segments
        valid = [valid[int(i * step)] for i in range(args.max_segments)]

    payload = {
        "faceRatio": round(confidence, 3),
        "detected": detected,
        "total": len(raw),
        "points": valid,
        "cropWidth": crop_w,
    }
    with open(args.out, "w", encoding="utf-8") as fh:
        json.dump(payload, fh)
    print(json.dumps({"ok": True, "faceRatio": payload["faceRatio"], "points": len(valid)}))


if __name__ == "__main__":
    main()
