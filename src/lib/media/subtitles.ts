/**
 * Subtitle engine — builds broadcast-grade ASS (Advanced SubStation) captions
 * with word-level highlighting, plus SRT/VTT exports.
 */

export interface Word {
  start: number;
  end: number;
  word: string;
  speaker?: number;
  probability?: number;
}

export interface Segment {
  start: number;
  end: number;
  text: string;
  speaker?: number;
}

export interface Transcript {
  language: string;
  words: Word[];
  segments: Segment[];
  provider?: string;
  model?: string;
}

export type SubtitleStyleId =
  | "mrbeast"
  | "gaming"
  | "podcast"
  | "minimal"
  | "bold"
  | "karaoke";

export type SubtitleAnimation = "pop" | "fade" | "slide" | "none";

export interface SubtitleConfig {
  style: SubtitleStyleId;
  fontFamily: string;
  /** Font size as a fraction of output height (0.03 – 0.12). */
  fontSize: number;
  textColor: string;
  highlightColor: string;
  outlineColor: string;
  outline: number;
  shadow: number;
  position: "top" | "middle" | "bottom";
  uppercase: boolean;
  emoji: boolean;
  maxWordsPerLine: number;
  animation: SubtitleAnimation;
  highlightWords: boolean;
  speakerLabels: boolean;
}

export const DEFAULT_SUBTITLE_CONFIG: SubtitleConfig = {
  style: "mrbeast",
  fontFamily: "Inter",
  fontSize: 0.062,
  textColor: "#FFFFFF",
  highlightColor: "#5EF0C6",
  outlineColor: "#050510",
  outline: 7,
  shadow: 4,
  position: "bottom",
  uppercase: true,
  emoji: true,
  maxWordsPerLine: 3,
  animation: "pop",
  highlightWords: true,
  speakerLabels: false,
};

export const STYLE_PRESETS: Record<SubtitleStyleId, Partial<SubtitleConfig>> = {
  mrbeast: {
    fontFamily: "Inter",
    fontSize: 0.072,
    highlightColor: "#5EF0C6",
    outline: 8,
    shadow: 5,
    uppercase: true,
    maxWordsPerLine: 3,
    animation: "pop",
    highlightWords: true,
    emoji: true,
    position: "bottom",
  },
  gaming: {
    fontFamily: "Inter",
    fontSize: 0.066,
    highlightColor: "#A855F7",
    outline: 8,
    shadow: 4,
    uppercase: true,
    maxWordsPerLine: 4,
    animation: "pop",
    highlightWords: true,
    emoji: false,
    position: "bottom",
  },
  podcast: {
    fontFamily: "Inter",
    fontSize: 0.042,
    highlightColor: "#7DD3FC",
    outline: 4,
    shadow: 3,
    uppercase: false,
    maxWordsPerLine: 7,
    animation: "fade",
    highlightWords: false,
    emoji: false,
    position: "bottom",
  },
  minimal: {
    fontFamily: "Inter",
    fontSize: 0.034,
    highlightColor: "#FFFFFF",
    outline: 3,
    shadow: 2,
    uppercase: false,
    maxWordsPerLine: 8,
    animation: "fade",
    highlightWords: false,
    emoji: false,
    position: "bottom",
  },
  bold: {
    fontFamily: "Inter",
    fontSize: 0.078,
    highlightColor: "#FFD84D",
    outline: 9,
    shadow: 6,
    uppercase: true,
    maxWordsPerLine: 2,
    animation: "pop",
    highlightWords: true,
    emoji: true,
    position: "middle",
  },
  karaoke: {
    fontFamily: "Inter",
    fontSize: 0.058,
    highlightColor: "#38BDF8",
    outline: 6,
    shadow: 3,
    uppercase: true,
    maxWordsPerLine: 3,
    animation: "none",
    highlightWords: true,
    emoji: false,
    position: "bottom",
  },
};

const EMOJI_MAP: Array<[RegExp, string]> = [
  [/\b(laugh|laughing|lol|haha|hilarious|joke|funny)\b/i, "😂"],
  [/\b(insane|crazy|unbelievable|no way|impossible)\b/i, "🤯"],
  [/\b(wow|whoa|amazing|incredible)\b/i, "😮"],
  [/\b(win|won|victory|clutch|gg)\b/i, "🏆"],
  [/\b(lose|lost|dead|died|eliminated)\b/i, "💀"],
  [/\b(money|dollar|million|rich|profit)\b/i, "💰"],
  [/\b(fire|hot|best|great)\b/i, "🔥"],
  [/\b(love|heart|beautiful)\b/i, "❤️"],
  [/\b(rage|angry|mad|furious)\b/i, "😡"],
  [/\b(scared|fear|terrified|creepy)\b/i, "😱"],
  [/\b(fast|speed|quick|run)\b/i, "⚡"],
  [/\b(game|gaming|play|player)\b/i, "🎮"],
  [/\b(music|song|sing)\b/i, "🎵"],
  [/\b(secret|truth|hidden)\b/i, "🤫"],
  [/\b(help|please|emergency)\b/i, "🆘"],
  [/\b(think|idea|brain|smart)\b/i, "🧠"],
];

export function suggestEmoji(text: string): string | null {
  for (const [re, emoji] of EMOJI_MAP) if (re.test(text)) return emoji;
  return null;
}

/** #RRGGBB -> ASS &HAABBGGRR */
export function toAssColor(hex: string, alpha = 0): string {
  const clean = hex.replace("#", "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean.padEnd(6, "0").slice(0, 6);
  const r = full.slice(0, 2);
  const g = full.slice(2, 4);
  const b = full.slice(4, 6);
  const a = Math.round(alpha * 255)
    .toString(16)
    .padStart(2, "0");
  return `&H${a}${b}${g}${r}`.toUpperCase();
}

function assTime(seconds: number): string {
  const s = Math.max(0, seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  const cs = Math.round((s - Math.floor(s)) * 100);
  return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}.${String(
    Math.min(99, cs),
  ).padStart(2, "0")}`;
}

export interface CaptionChunk {
  start: number;
  end: number;
  words: Word[];
  speaker?: number;
}

/** Groups words into readable caption chunks without splitting a word. */
export function buildChunks(
  words: Word[],
  cfg: SubtitleConfig,
  opts: { minDuration?: number; maxDuration?: number } = {},
): CaptionChunk[] {
  const minDuration = opts.minDuration ?? 0.35;
  const maxDuration = opts.maxDuration ?? 3.2;
  const sorted = [...words]
    .filter((w) => Number.isFinite(w.start) && Number.isFinite(w.end) && w.word?.trim())
    .sort((a, b) => a.start - b.start);

  const chunks: CaptionChunk[] = [];
  let current: Word[] = [];

  const flush = () => {
    if (!current.length) return;
    const start = current[0].start;
    let end = current[current.length - 1].end + 0.12;
    if (end - start < minDuration) end = start + minDuration;
    chunks.push({
      start,
      end,
      words: current,
      speaker: current[0].speaker,
    });
    current = [];
  };

  for (const word of sorted) {
    if (!current.length) {
      current.push(word);
      continue;
    }
    const prev = current[current.length - 1];
    const gap = word.start - prev.end;
    const span = word.end - current[0].start;
    const breaks =
      gap > 0.55 ||
      current.length >= cfg.maxWordsPerLine ||
      span > maxDuration ||
      (word.speaker !== undefined && prev.speaker !== undefined && word.speaker !== prev.speaker);
    if (breaks) {
      flush();
      current.push(word);
    } else current.push(word);
  }
  flush();

  // Never let a caption overlap the next one.
  for (let i = 0; i < chunks.length - 1; i++) {
    if (chunks[i].end > chunks[i + 1].start) {
      chunks[i].end = Math.max(chunks[i].start + 0.2, chunks[i + 1].start - 0.02);
    }
  }
  return chunks;
}

function escapeAss(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/\{/g, "(").replace(/\}/g, ")").replace(/\n/g, " ");
}

export interface BuildAssOptions {
  width: number;
  height: number;
  /** Seconds removed from the start of the source -> caption time origin. */
  offsetSec?: number;
  speakerNames?: string[];
}

/** Builds a full .ass document with word-level highlight timing. */
/**
 * Long words or wide fonts can overflow the frame. ASS can't wrap for us in
 * every style, so measure the plain text and inject a smaller `\fs` override
 * when a line would be wider than the safe area.
 */
function fitOverride(plain: string, fontSize: number, width: number): string {
  const safe = width - 130; // margins on both sides
  const estimated = plain.replace(/\{[^}]*\}/g, "").length * fontSize * 0.62;
  if (estimated <= safe) return "";
  const size = Math.max(20, Math.floor(fontSize * (safe / estimated)));
  return `\\fs${size}`;
}

export function buildAss(
  transcript: Transcript,
  cfg: SubtitleConfig,
  opts: BuildAssOptions,
): string {
  const offset = opts.offsetSec ?? 0;
  const chunks = buildChunks(transcript.words, cfg);
  const primary = toAssColor(cfg.textColor);
  const highlight = toAssColor(cfg.highlightColor);
  const outline = toAssColor(cfg.outlineColor);
  const fontSize = Math.round(Math.max(18, cfg.fontSize * opts.height));

  const align = cfg.position === "top" ? 8 : cfg.position === "middle" ? 5 : 2;
  const marginV =
    cfg.position === "bottom"
      ? Math.round(opts.height * 0.17)
      : cfg.position === "top"
        ? Math.round(opts.height * 0.1)
        : 0;

  const animIn =
    cfg.animation === "pop"
      ? "\\fscx70\\fscy70\\t(0,120,\\fscx105\\fscy105)\\t(120,220,\\fscx100\\fscy100)"
      : cfg.animation === "slide"
        ? "\\fad(80,80)\\move(540,%H%+40,540,%H%,0,160)"
        : cfg.animation === "fade"
          ? "\\fad(120,120)"
          : "";

  const header = `[Script Info]
Title: Clipwave captions
ScriptType: v4.00+
PlayResX: ${opts.width}
PlayResY: ${opts.height}
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Caption,${cfg.fontFamily},${fontSize},${primary},${primary},${outline},&H96000000,-1,0,0,0,100,100,${cfg.uppercase ? 1 : 0},0,1,${cfg.outline.toFixed(
    1,
  )},${cfg.shadow.toFixed(1)},${align},60,60,${marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  const lines: string[] = [];
  for (const chunk of chunks) {
    const start = chunk.start - offset;
    const end = chunk.end - offset;
    if (end <= 0) continue;
    const safeStart = Math.max(0, start);

    let words = chunk.words.map((w) => (cfg.uppercase ? w.word.toUpperCase() : w.word));
    if (cfg.speakerLabels && chunk.speaker !== undefined) {
      const name = opts.speakerNames?.[chunk.speaker] ?? `Speaker ${chunk.speaker + 1}`;
      words = [`${name}:`, ...words];
    }
    let text = words.join(" ");
    if (cfg.emoji) {
      const emoji = suggestEmoji(chunk.words.map((w) => w.word).join(" "));
      if (emoji) text = `${text} ${emoji}`;
    }

    if (cfg.style === "karaoke") {
      // \k tags: one per word, timed in centiseconds.
      let body = "";
      chunk.words.forEach((w, i) => {
        const next = chunk.words[i + 1]?.start ?? chunk.end;
        const dur = Math.max(8, Math.round((next - w.start) * 100));
        const word = cfg.uppercase ? w.word.toUpperCase() : w.word;
        body += `{\\kf${dur}}${escapeAss(word)} `;
      });
      const kPlain = words.join(" ");
      lines.push(
        `Dialogue: 0,${assTime(safeStart)},${assTime(end)},Caption,,0,0,0,,{\\an${align}${animIn}${fitOverride(
          kPlain,
          fontSize,
          opts.width,
        )}}${body.trim()}`,
      );
      continue;
    }

    if (cfg.highlightWords) {
      chunk.words.forEach((word, index) => {
        const from = Math.max(0, word.start - offset);
        const toRaw = index === chunk.words.length - 1 ? end : (chunk.words[index + 1].start - offset);
        const to = Math.max(from + 0.08, toRaw);
        if (to <= 0) return;
        const rendered = words
          .map((w, i) =>
            i === index
              ? `{\\c${highlight}\\b1\\fscx112\\fscy112}${escapeAss(w)}{\\c${primary}\\b1\\fscx100\\fscy100}`
              : escapeAss(w),
          )
          .join(" ");
        lines.push(
          `Dialogue: 0,${assTime(Math.max(0, from))},${assTime(to)},Caption,,0,0,0,,{\\an${align}${animIn}${fitOverride(
            text,
            fontSize,
            opts.width,
          )}}${rendered}`,
        );
      });
    } else {
      lines.push(
        `Dialogue: 0,${assTime(safeStart)},${assTime(end)},Caption,,0,0,0,,{\\an${align}${animIn}${fitOverride(
          text,
          fontSize,
          opts.width,
        )}}${escapeAss(text)}`,
      );
    }
  }

  return header + lines.join("\n") + "\n";
}

export function buildSrt(transcript: Transcript, cfg: SubtitleConfig): string {
  const chunks = buildChunks(transcript.words, cfg);
  const srtTime = (s: number) => {
    const ms = Math.max(0, Math.round(s * 1000));
    const h = Math.floor(ms / 3_600_000);
    const m = Math.floor((ms % 3_600_000) / 60_000);
    const sec = Math.floor((ms % 60_000) / 1000);
    const milli = ms % 1000;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(
      2,
      "0",
    )},${String(milli).padStart(3, "0")}`;
  };
  return chunks
    .map((c, i) => {
      const text = c.words
        .map((w) => (cfg.uppercase ? w.word.toUpperCase() : w.word))
        .join(" ");
      return `${i + 1}\n${srtTime(c.start)} --> ${srtTime(c.end)}\n${text}\n`;
    })
    .join("\n");
}

/** Words for a given time range, re-based to 0 for clip-local rendering. */
export function sliceWords(words: Word[], startSec: number, endSec: number): Word[] {
  return words
    .filter((w) => w.end > startSec + 0.02 && w.start < endSec - 0.02)
    .map((w) => ({
      ...w,
      start: Math.max(0, w.start - startSec),
      end: Math.max(0.05, Math.min(endSec, w.end) - startSec),
    }));
}

export function wordsToText(words: Word[]): string {
  return words
    .map((w) => w.word)
    .join(" ")
    .replace(/\s+([.,!?;:])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}
