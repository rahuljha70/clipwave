#!/usr/bin/env sh
# Installs the fonts used by the caption renderer and thumbnail composer.
#   npm run setup:fonts
# Inter + Poppins (UI/captions), Anton (bold viral), Noto Sans Devanagari
# (Hindi/Nepali subtitles). Falls back gracefully to DejaVu if skipped.
set -e

DEST="${HOME}/.local/share/fonts"
mkdir -p "$DEST"

fetch() {
  url="$1"; out="$2"
  if [ -f "$DEST/$out" ]; then echo "  · $out already installed"; return; fi
  echo "  ↓ $out"
  curl -fsSL "$url" -o "$DEST/$out" || echo "  ! failed: $out"
}

BASE="https://raw.githubusercontent.com/google/fonts/main"

fetch "$BASE/ofl/inter/Inter%5Bopsz%2Cwght%5D.ttf" "Inter.ttf"
fetch "$BASE/ofl/poppins/Poppins-Bold.ttf" "Poppins-Bold.ttf"
fetch "$BASE/ofl/poppins/Poppins-ExtraBold.ttf" "Poppins-ExtraBold.ttf"
fetch "$BASE/ofl/anton/Anton-Regular.ttf" "Anton-Regular.ttf"
fetch "$BASE/ofl/notosansdevanagari/NotoSansDevanagari%5Bwdth%2Cwght%5D.ttf" "NotoSansDevanagari.ttf"

if command -v fc-cache >/dev/null 2>&1; then
  fc-cache -f "$DEST" >/dev/null 2>&1 || true
  echo "✓ font cache refreshed ($DEST)"
else
  echo "! fontconfig not found — install it (apt install fontconfig) for captions to use these fonts"
fi
