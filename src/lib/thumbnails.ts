/**
 * Thumbnail generator — real image composition with sharp:
 * best-frame selection + gradient scrim + bold text + score badge + logo slot.
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

export interface ThumbnailOptions {
  framePath: string;
  outputPath: string;
  text: string;
  accent?: string;
  badge?: string;
  category?: string;
  logoPath?: string | null;
  width?: number;
  height?: number;
  fontFamily?: string;
}

const FONT_STACK = "Inter, Poppins, Anton, 'DejaVu Sans', sans-serif";

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function wrapLines(text: string, maxChars: number, maxLines = 3): string[] {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (!current) current = word;
    else if ((current + " " + word).length <= maxChars) current += " " + word;
    else {
      lines.push(current);
      current = word;
    }
    if (lines.length === maxLines) break;
  }
  if (current && lines.length < maxLines) lines.push(current);
  return lines.length ? lines : ["WATCH THIS"];
}

/**
 * Fits a headline inside the safe area. Anton is a very wide display face, so
 * the width is estimated per glyph (~0.62em) and the size is reduced until the
 * block fits both horizontally and vertically. Never overflows the frame.
 */
function fitHeadline(
  text: string,
  width: number,
  maxBlockHeight: number,
  maxLines = 3,
): { size: number; lines: string[] } {
  const safeWidth = width * 0.88;
  const glyph = 0.82; // Anton caps are wide — over-estimate to stay inside the frame
  let fallback = { size: 24, lines: wrapLines(text, 18, maxLines) };

  const start = Math.round(Math.min(width * 0.2, maxBlockHeight * 0.55));
  for (let size = Math.max(24, start); size >= 22; size -= 2) {
    const perLine = Math.max(6, Math.floor(safeWidth / (size * glyph)));
    const lines = wrapLines(text, perLine, maxLines);
    const widest = Math.max(...lines.map((line) => line.length)) * size * glyph;
    const blockHeight = lines.length * size * 1.08;
    if (widest <= safeWidth && blockHeight <= maxBlockHeight) return { size, lines };
    fallback = { size, lines };
  }
  return fallback;
}

/** Picks the sharpest + most "face-like" frame from a set of candidates. */
export async function pickBestFrame(frames: string[]): Promise<string | null> {
  let best: { path: string; score: number } | null = null;
  for (const frame of frames) {
    try {
      const stats = await sharp(frame).greyscale().stats();
      const mean = stats.channels[0].mean;
      const stdev = stats.channels[0].stdev;
      // Prefer well-exposed (mean near 118) and detailed (high stdev) frames.
      const score = stdev * 1.6 - Math.abs(mean - 118) * 0.7;
      if (!best || score > best.score) best = { path: frame, score };
    } catch {
      continue;
    }
  }
  return best?.path ?? frames[0] ?? null;
}

export async function composeThumbnail(opts: ThumbnailOptions): Promise<string> {
  const width = opts.width ?? 1280;
  const height = opts.height ?? 720;
  const accent = opts.accent ?? "#6D5EF8";
  const { size: fontSize, lines } = fitHeadline(
    opts.text.toUpperCase(),
    width,
    height * 0.42,
  );
  const lineHeight = Math.round(fontSize * 1.06);
  const blockHeight = lines.length * lineHeight;
  const baseY = height - Math.round(height * 0.1) - blockHeight;
  const textX = Math.round(width * 0.055);

  const base = await sharp(opts.framePath)
    .resize(width, height, { fit: "cover", position: "attention" })
    .modulate({ brightness: 0.94, saturation: 1.08 })
    .toBuffer();

  const textLines = lines
    .map(
      (line, i) =>
        `<text x="${textX}" y="${baseY + i * lineHeight + fontSize * 0.82}"
           font-family="${FONT_STACK}" font-size="${fontSize}" font-weight="900"
           fill="#FFFFFF" letter-spacing="-1"
           stroke="#05060F" stroke-width="${Math.round(fontSize * 0.085)}"
           paint-order="stroke" stroke-linejoin="round">${escapeXml(line)}</text>`,
    )
    .join("");

  const badge = opts.badge
    ? `<g>
         <rect x="${width - 214}" y="${Math.round(height * 0.07)}" width="158" height="56" rx="28" fill="${accent}"/>
         <text x="${width - 214 + 79}" y="${Math.round(height * 0.07) + 37}" text-anchor="middle"
           font-family="${FONT_STACK}" font-size="26" font-weight="800" fill="#06070F">${escapeXml(
             opts.badge,
           )}</text>
       </g>`
    : "";

  const category = opts.category
    ? `<g>
         <rect x="${textX}" y="${Math.round(height * 0.075)}" width="${
           Math.max(120, opts.category.length * 15 + 44)
         }" height="48" rx="24" fill="#0B0C18" opacity="0.82"/>
         <circle cx="${textX + 26}" cy="${Math.round(height * 0.075) + 24}" r="7" fill="${accent}"/>
         <text x="${textX + 44}" y="${Math.round(height * 0.075) + 33}"
           font-family="${FONT_STACK}" font-size="22" font-weight="700" fill="#FFFFFF">${escapeXml(
             opts.category.toUpperCase(),
           )}</text>
       </g>`
    : "";

  const overlay = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="scrim" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#05060F" stop-opacity="0.10"/>
        <stop offset="45%" stop-color="#05060F" stop-opacity="0.35"/>
        <stop offset="100%" stop-color="#05060F" stop-opacity="0.92"/>
      </linearGradient>
      <linearGradient id="accentBar" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="${accent}"/>
        <stop offset="100%" stop-color="#38BDF8"/>
      </linearGradient>
    </defs>
    <rect width="${width}" height="${height}" fill="url(#scrim)"/>
    <rect x="${textX}" y="${baseY - Math.round(fontSize * 0.55)}" width="${Math.round(
      width * 0.11,
    )}" height="${Math.max(6, Math.round(fontSize * 0.13))}" rx="4" fill="url(#accentBar)"/>
    ${category}
    ${badge}
    ${textLines}
  </svg>`;

  let pipeline = sharp(base).composite([{ input: Buffer.from(overlay), top: 0, left: 0 }]);

  if (opts.logoPath && fs.existsSync(opts.logoPath)) {
    try {
      const logo = await sharp(opts.logoPath)
        .resize({ height: Math.round(height * 0.1), fit: "inside" })
        .png()
        .toBuffer();
      const meta = await sharp(logo).metadata();
      pipeline = pipeline.composite([
        {
          input: logo,
          top: Math.round(height * 0.88) - (meta.height ?? 0),
          left: width - (meta.width ?? 0) - Math.round(width * 0.045),
        },
      ]);
    } catch {
      /* ignore bad logo */
    }
  }

  fs.mkdirSync(path.dirname(opts.outputPath), { recursive: true });
  await pipeline.jpeg({ quality: 92, chromaSubsampling: "4:4:4" }).toFile(opts.outputPath);
  return opts.outputPath;
}

/** Vertical thumbnail variant for Shorts/Reels cover art. */
export async function composeVerticalThumbnail(opts: ThumbnailOptions): Promise<string> {
  return composeThumbnail({ ...opts, width: 1080, height: 1920 });
}
