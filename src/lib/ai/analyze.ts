/**
 * Moment detection ("the clipping engine").
 *
 * Pure, deterministic algorithm over two real signals:
 *   1. The word-level transcript (semantics, hooks, pacing, context boundaries)
 *   2. Acoustic features per 0.5 s window (energy, spectral flux, pitch, pauses)
 *
 * An optional LLM pass can re-rank and label the candidates when an
 * OpenAI-compatible key is configured; the ranking always works without it.
 */
import type { Transcript, Word } from "../media/subtitles";
import type { AudioFeatures } from "./stt";
import { chatJson } from "./llm";

export type MomentCategory =
  | "funny"
  | "reaction"
  | "gaming"
  | "conversation"
  | "emotional"
  | "rage"
  | "fact"
  | "energy"
  | "quote"
  | "suspense";

export const CATEGORY_LABEL: Record<MomentCategory, string> = {
  funny: "Funny moment",
  reaction: "Unexpected reaction",
  gaming: "Gaming highlight",
  conversation: "Important conversation",
  emotional: "Emotional moment",
  rage: "Rage moment",
  fact: "Interesting fact",
  energy: "High-energy moment",
  quote: "Memorable quote",
  suspense: "Suspenseful build-up",
};

export interface ScoreBreakdown {
  hook: number;
  retention: number;
  emotion: number;
  energy: number;
  humor: number;
  unexpected: number;
  lengthFit: number;
  context: number;
}

export interface Moment {
  start: number;
  end: number;
  duration: number;
  score: number;
  category: MomentCategory;
  reason: string;
  hook: string;
  bestPlatform: string;
  improvements: string[];
  breakdown: ScoreBreakdown;
  transcript: string;
  words: Word[];
  speakers: number[];
}

const HUMOR = /\b(laugh|laughs|laughing|lol|lmao|haha|hehe|joke|joking|funny|hilarious|comedy|troll|memes?|bruh|xd)\b/i;
const RAGE = /\b(what the|wtf|ffs|are you serious|unbelievable|ridiculous|stupid|idiot|trash|garbage|scam|rage|furious|angry|mad|screaming|yelling|damn)\b/i;
const EMOTION = /\b(love|cried|crying|tears|scared|afraid|nervous|heartbroken|grateful|thank you|family|mom|dad|proud|emotional|honestly|vulnerable)\b/i;
const FACT = /\b(did you know|actually|in fact|the truth is|statistically|percent|study|research|scientists|history|never knew|turns out|explains)\b/i;
const GAMING = /\b(clutch|ace|gg|ez|headshot|no scope|1v1|1v2|1v3|1v4|1v5|ranked|lobby|boss|speedrun|respawn|eliminated|carry|noscope|combo|frag|meta|nerf|buff|win streak)\b/i;
const SURPRISE = /\b(wait|hold on|no way|oh my god|omg|what just happened|look at this|watch this|insane|crazy|unbelievable|holy|whoa|bro)\b/i;
const SUSPENSE = /\b(but then|suddenly|and then|before you know|the problem is|here's the thing|until|what happened next|plot twist)\b/i;
const ENERGY = /\b(let's go|lesgo|yes+|yeah+|oh+|come on|go go|huge|massive|unreal|incredible|best|worst|fastest)\b/i;
const QUOTE = /\b(never|always|everything|nothing|nobody|everybody|the only|the truth|remember this|mark my words)\b/i;
const HOOK_WORDS = /\b(you|your|why|how|what|secret|nobody|everyone|stop|never|always|this is|here's|imagine|truth|mistake|wrong)\b/i;
const QUESTION_END = /[?]\s*$/;
const EXCLAIM_END = /[!]\s*$/;

interface Sentence {
  start: number;
  end: number;
  text: string;
  words: Word[];
  speaker: number;
  wordsPerSec: number;
}

const countMatches = (text: string, re: RegExp) => (text.match(re) ? (text.match(re) as RegExpMatchArray).length : 0);

function buildSentences(words: Word[]): Sentence[] {
  const sentences: Sentence[] = [];
  let current: Word[] = [];
  const flush = () => {
    if (!current.length) return;
    const text = current.map((w) => w.word).join(" ").trim();
    const start = current[0].start;
    const end = current[current.length - 1].end;
    sentences.push({
      start,
      end,
      text,
      words: current,
      speaker: current[0].speaker ?? 0,
      wordsPerSec: end > start ? current.length / (end - start) : 0,
    });
    current = [];
  };
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const prev = current[current.length - 1];
    if (prev) {
      const gap = w.start - prev.end;
      const span = w.end - current[0].start;
      if (gap > 0.7 || span > 14 || /[.!?]$/.test(prev.word) || w.speaker !== prev.speaker && gap > 0.4) {
        flush();
      }
    }
    current.push(w);
  }
  flush();
  return sentences;
}

function frameStats(features: AudioFeatures) {
  const frames = features.frames ?? [];
  const dbs = frames.map((f) => f.rmsDb).filter((n) => Number.isFinite(n));
  const sorted = [...dbs].sort((a, b) => a - b);
  const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : -50;
  const p95 = sorted.length ? sorted[Math.floor(sorted.length * 0.95)] : median + 10;
  const speechRatio = frames.length
    ? frames.filter((f) => f.speech).length / frames.length
    : 0.5;
  return { dbs, median, p95, speechRatio, frames };
}

function windowFeatures(features: AudioFeatures, start: number, end: number) {
  const frames = (features.frames ?? []).filter((f) => f.t >= start && f.t <= end);
  if (!frames.length) return { meanDb: -50, peakDb: -50, flux: 0, pitchVar: 0, speechRatio: 0, silence: 1 };
  const dbs = frames.map((f) => f.rmsDb);
  const meanDb = dbs.reduce((a, b) => a + b, 0) / dbs.length;
  const peakDb = Math.max(...dbs);
  const flux = Math.max(...frames.map((f) => f.flux));
  const pitches = frames.map((f) => f.pitch).filter((p) => p > 0);
  const meanPitch = pitches.length ? pitches.reduce((a, b) => a + b, 0) / pitches.length : 0;
  const pitchVar = pitches.length
    ? Math.sqrt(pitches.reduce((a, b) => a + (b - meanPitch) ** 2, 0) / pitches.length)
    : 0;
  const speechRatio = frames.filter((f) => f.speech).length / frames.length;
  return { meanDb, peakDb, flux, pitchVar, speechRatio, silence: 1 - speechRatio };
}

const clamp = (v: number, min = 0, max = 100) => Math.max(min, Math.min(max, v));

function classify(text: string, ctx: { energyZ: number; flux: number; pitchVar: number }): MomentCategory {
  const scores: Array<[MomentCategory, number]> = [
    ["funny", countMatches(text, HUMOR) * 3],
    ["rage", countMatches(text, RAGE) * 2.5],
    ["gaming", countMatches(text, GAMING) * 3],
    ["emotional", countMatches(text, EMOTION) * 2.2],
    ["fact", countMatches(text, FACT) * 2.4],
    ["reaction", countMatches(text, SURPRISE) * 2.6 + (ctx.energyZ > 1.6 ? 2 : 0)],
    ["suspense", countMatches(text, SUSPENSE) * 2],
    ["energy", countMatches(text, ENERGY) * 2 + (ctx.flux > 0.55 ? 2 : 0)],
    ["quote", countMatches(text, QUOTE) * 1.6],
  ];
  scores.sort((a, b) => b[1] - a[1]);
  if (scores[0][1] >= 2) return scores[0][0];
  if (ctx.pitchVar > 45 && ctx.energyZ > 0.8) return "reaction";
  if (ctx.flux > 0.6) return "energy";
  return "conversation";
}

function platformFor(category: MomentCategory, duration: number): string {
  if (category === "gaming" || category === "funny" || category === "rage") return "TikTok";
  if (category === "emotional" || category === "quote") return "Instagram Reels";
  if (duration >= 55) return "YouTube Shorts";
  if (category === "fact" || category === "conversation") return "YouTube Shorts";
  return "TikTok";
}

export interface AnalyzeOptions {
  targetLength: number;
  maxClips: number;
  useLlm?: boolean;
  title?: string;
  channel?: string | null;
  language?: string;
}

export async function detectMoments(
  transcript: Transcript,
  features: AudioFeatures,
  opts: AnalyzeOptions,
): Promise<{ moments: Moment[]; meta: Record<string, unknown> }> {
  const target = opts.targetLength || 30;
  const sentences = buildSentences(transcript.words ?? []);
  const stats = frameStats(features);

  if (sentences.length === 0) {
    // No speech (music/gameplay only): fall back to acoustic peaks.
    const acoustic = acousticOnlyMoments(features, target, opts.maxClips);
    return {
      moments: acoustic,
      meta: { mode: "acoustic", reason: "No speech detected — clips chosen from audio energy peaks.", sentences: 0 },
    };
  }

  interface Candidate {
    moment: Moment;
    sentenceIds: [number, number];
  }
  const candidates: Candidate[] = [];
  const minLen = Math.max(6, target * 0.72);
  const maxLen = target * 1.35;

  for (let i = 0; i < sentences.length; i++) {
    for (let j = i; j < sentences.length; j++) {
      const start = sentences[i].start;
      const end = sentences[j].end;
      const duration = end - start;
      if (duration < minLen && j < sentences.length - 1) continue;
      if (duration > maxLen) break;
      if (duration < minLen * 0.8) continue;

      const words = transcript.words.filter((w) => w.end > start && w.start < end);
      if (words.length < 6) continue;
      const text = words.map((w) => w.word).join(" ");
      const feat = windowFeatures(features, start, end);

      const energyZ = stats.p95 > stats.median ? (feat.peakDb - stats.median) / Math.max(1, stats.p95 - stats.median) : 0;
      const hookText = sentences[i].text;
      const lastText = sentences[j].text;
      const wps = words.length / Math.max(1, duration);

      const hook = clamp(
        12 +
          (QUESTION_END.test(hookText) ? 26 : 0) +
          (EXCLAIM_END.test(hookText) ? 20 : 0) +
          countMatches(hookText, HOOK_WORDS) * 9 +
          countMatches(hookText, SURPRISE) * 12 +
          (feat.peakDb - stats.median > 6 ? 12 : 0),
      );

      const retention = clamp(
        30 +
          (wps >= 2.2 && wps <= 5.2 ? 22 : wps < 1.4 ? -18 : 4) +
          Math.min(20, feat.speechRatio * 26) +
          Math.min(14, feat.flux * 18) -
          Math.max(0, feat.silence * 22),
      );

      const emotion = clamp(
        22 +
          Math.min(30, Math.abs(energyZ) * 16) +
          Math.min(24, feat.pitchVar / 2.2) +
          countMatches(text, EMOTION) * 6 +
          countMatches(text, RAGE) * 7,
      );

      const energy = clamp(20 + Math.min(40, Math.max(0, energyZ) * 22) + featureRatio(feat, stats) * 30);

      const humor = clamp(10 + countMatches(text, HUMOR) * 22);
      const unexpected = clamp(
        14 +
          Math.max(0, energyZ - 0.4) * 26 +
          countMatches(text, SURPRISE) * 10 +
          countMatches(text, RAGE) * 8,
      );
      const lengthFit = clamp(100 - Math.abs(duration - target) / Math.max(8, target) * 90);
      const context = clamp(
        58 +
          (startsCleanly(sentences[i].text) ? 26 : -14) +
          (endsCleanly(lastText) ? 22 : -10) +
          (words[0].start - start < 0.6 ? 8 : -6),
      );

      const score = Math.round(
        hook * 0.2 +
          retention * 0.18 +
          emotion * 0.15 +
          energy * 0.12 +
          humor * 0.09 +
          unexpected * 0.12 +
          lengthFit * 0.08 +
          context * 0.06,
      );

      const category = classify(text, { energyZ, flux: feat.flux, pitchVar: feat.pitchVar });

      candidates.push({
        sentenceIds: [i, j],
        moment: {
          start,
          end,
          duration,
          score: clamp(score, 1, 99),
          category,
          reason: "",
          hook: makeHook(hookText),
          bestPlatform: platformFor(category, duration),
          improvements: [],
          breakdown: {
            hook: Math.round(hook),
            retention: Math.round(retention),
            emotion: Math.round(emotion),
            energy: Math.round(energy),
            humor: Math.round(humor),
            unexpected: Math.round(unexpected),
            lengthFit: Math.round(lengthFit),
            context: Math.round(context),
          },
          transcript: text,
          words,
          speakers: Array.from(new Set(words.map((w) => w.speaker ?? 0))),
        },
      });
      break; // one window per starting sentence keeps candidates focused
    }
  }

  if (!candidates.length) {
    return {
      moments: acousticOnlyMoments(features, target, opts.maxClips),
      meta: { mode: "acoustic", reason: "Speech was too sparse for transcript analysis." },
    };
  }

  // Non-maximum suppression on time overlap.
  candidates.sort((a, b) => b.moment.score - a.moment.score);
  const picked: Candidate[] = [];
  for (const cand of candidates) {
    const overlaps = picked.some(
      (p) =>
        Math.min(p.moment.end, cand.moment.end) - Math.max(p.moment.start, cand.moment.start) >
        Math.min(p.moment.duration, cand.moment.duration) * 0.35,
    );
    if (!overlaps) picked.push(cand);
    if (picked.length >= opts.maxClips) break;
  }
  picked.sort((a, b) => a.moment.start - b.moment.start);

  let moments = picked.map((p) => finalise(p.moment, target, sentences, transcript));
  let meta: Record<string, unknown> = {
    mode: "transcript",
    sentences: sentences.length,
    candidates: candidates.length,
    speechRatio: Math.round(stats.speechRatio * 100) / 100,
    baselineDb: Math.round(stats.median),
  };

  if (opts.useLlm) {
    const refined = await refineWithLlm(moments, opts);
    if (refined) {
      moments = refined;
      meta = { ...meta, llm: "applied" };
    } else {
      meta = { ...meta, llm: "unavailable" };
    }
  }

  return { moments, meta };
}

function featureRatio(feat: { meanDb: number; peakDb: number }, stats: { median: number }) {
  const ratio = (feat.meanDb - stats.median + 20) / 40;
  return Math.max(0, Math.min(1, ratio));
}

function startsCleanly(text: string) {
  return /^[A-Z0-9"'“]/.test(text.trim()) || /^(so|and|but|okay|ok|well|look|wait|now)/i.test(text.trim());
}

function endsCleanly(text: string) {
  return /[.!?]"?$/.test(text.trim());
}

function makeHook(sentence: string): string {
  const clean = sentence
    .replace(/^(so|and|but|um|uh|like|you know|okay|ok)[,\s]+/i, "")
    .replace(/\s+/g, " ")
    .trim();
  const firstClause = clean.split(/[.!?]/)[0] ?? clean;
  const trimmed = firstClause.split(/\s+/).slice(0, 12).join(" ");
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function finalise(moment: Moment, target: number, sentences: Sentence[], transcript: Transcript): Moment {
  // Snap to safe boundaries: never cut a word, keep ~0.3 s of lead-in / tail.
  const first = moment.words[0];
  const last = moment.words[moment.words.length - 1];
  const start = Math.max(0, Math.min(moment.start, first.start - 0.35));
  let end = Math.min(last.end + 0.45, Math.max(moment.end, last.end + 0.2));
  if (end - start < target * 0.6) end = Math.min(last.end + 1.2, start + target * 0.8);

  const words = transcript.words
    .filter((w) => w.end > start && w.start < end)
    .map((w) => ({ ...w, start: Math.max(0, w.start - start), end: Math.max(0.05, w.end - start) }));

  const reasonParts: string[] = [];
  const b = moment.breakdown;
  if (b.hook >= 55) reasonParts.push("opens on a strong verbal hook");
  if (b.emotion >= 60) reasonParts.push("delivers obvious emotional intensity");
  if (b.unexpected >= 60) reasonParts.push("spikes in energy against the rest of the stream");
  if (b.humor >= 50) reasonParts.push("lands a comedic beat with laughter cues");
  if (b.retention >= 65) reasonParts.push("keeps a fast, steady pace that protects retention");
  if (b.context >= 70) reasonParts.push("starts and ends on complete thoughts");
  if (!reasonParts.length) reasonParts.push("holds consistent speech energy across a complete thought");

  const improvements: string[] = [];
  if (moment.start > 0.5) improvements.push("Trim the lead-in if the first 0.5 s feels slow.");
  if (b.retention < 55) improvements.push("Cut dead air between sentences to raise pacing.");
  if (b.lengthFit < 60)
    improvements.push(
      `Length is ${Math.round(moment.duration)}s — ${moment.duration > target ? "trim the outro" : "extend the setup"} to hit ${target}s.`,
    );
  if (b.hook < 50) improvements.push("Add a text hook overlay in the first 2 seconds.");
  improvements.push("Test a MrBeast caption style — it lifts retention on this category.");

  return {
    ...moment,
    start: Math.round(start * 100) / 100,
    end: Math.round(end * 100) / 100,
    duration: Math.round((end - start) * 100) / 100,
    words,
    reason: `Selected because it ${joinClauses(reasonParts)}.`,
    improvements: improvements.slice(0, 3),
  };
}

function joinClauses(parts: string[]): string {
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

function acousticOnlyMoments(features: AudioFeatures, target: number, maxClips: number): Moment[] {
  const frames = features.frames ?? [];
  if (!frames.length) return [];
  const duration = features.duration || frames[frames.length - 1].t + features.window;
  const step = Math.max(5, Math.min(target, 30));
  const out: Moment[] = [];
  for (let t = 0; t + step <= duration; t += step) {
    const win = windowFeatures(features, t, t + step);
    const score = Math.round(
      clamp(28 + Math.min(50, Math.max(0, win.peakDb + 40)) + win.flux * 22, 5, 92),
    );
    out.push({
      start: t,
      end: t + step,
      duration: step,
      score,
      category: win.flux > 0.5 ? "energy" : "conversation",
      reason: `Acoustic peak: ${win.peakDb.toFixed(1)} dB peak with onset strength ${(win.flux * 100).toFixed(0)}%.`,
      hook: "High-energy moment",
      bestPlatform: "TikTok",
      improvements: ["Add captions manually — no speech was detected in this section."],
      breakdown: {
        hook: 40,
        retention: Math.round(win.speechRatio * 60),
        emotion: 35,
        energy: Math.round(clamp(win.peakDb + 60)),
        humor: 10,
        unexpected: Math.round(win.flux * 100),
        lengthFit: 70,
        context: 40,
      },
      transcript: "",
      words: [],
      speakers: [],
    });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, maxClips);
}

const VALID_CATEGORIES = Object.keys(CATEGORY_LABEL) as MomentCategory[];

async function refineWithLlm(moments: Moment[], opts: AnalyzeOptions): Promise<Moment[] | null> {
  if (!moments.length) return null;
  const payload = moments.map((m, i) => ({
    id: i,
    start: Math.round(m.start),
    length: Math.round(m.duration),
    transcript: m.transcript.slice(0, 900),
  }));
  const result = await chatJson<{
    clips: Array<{
      id: number;
      score: number;
      category: string;
      hook: string;
      reason: string;
      improvements?: string[];
    }>;
  }>(
    [
      {
        role: "system",
        content:
          "You are a short-form video editor who has produced thousands of viral clips from podcasts and livestreams. " +
          "Rank each candidate clip by genuine short-form potential. Be honest and avoid clickbait that misrepresents the content. " +
          `Valid categories: ${VALID_CATEGORIES.join(", ")}. ` +
          'Reply with JSON: {"clips":[{"id":number,"score":0-100,"category":string,"hook":string (max 12 words, truthful),"reason":string (max 30 words),"improvements":string[]}]}',
      },
      {
        role: "user",
        content: `Source: ${opts.title ?? "livestream"}${opts.channel ? ` by ${opts.channel}` : ""}. Target clip length: ${opts.targetLength}s.\nCandidates:\n${JSON.stringify(payload)}`,
      },
    ],
    { maxTokens: 2000, temperature: 0.4 },
  );
  if (!result?.clips?.length) return null;

  const byId = new Map(result.clips.map((c) => [c.id, c]));
  return moments
    .map((m, i) => {
      const llm = byId.get(i);
      if (!llm) return m;
      const blended = Math.round(m.score * 0.55 + clamp(Number(llm.score) || m.score) * 0.45);
      const category = VALID_CATEGORIES.includes(llm.category as MomentCategory)
        ? (llm.category as MomentCategory)
        : m.category;
      return {
        ...m,
        score: blended,
        category,
        hook: (llm.hook || m.hook).slice(0, 120),
        reason: llm.reason ? String(llm.reason).slice(0, 300) : m.reason,
        improvements: Array.isArray(llm.improvements) && llm.improvements.length
          ? llm.improvements.slice(0, 3).map((s) => String(s).slice(0, 160))
          : m.improvements,
      };
    })
    .sort((a, b) => b.score - a.score);
}
