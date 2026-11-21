/**
 * Viral title / description / hashtag / SEO engine.
 *
 * A deterministic template + keyphrase engine that always runs, with an optional
 * LLM pass for extra variety when a key is configured. Scores are heuristic
 * editorial guidance — not a prediction of views.
 */
import type { Moment, MomentCategory } from "./analyze";
import { CATEGORY_LABEL } from "./analyze";
import { chatJson } from "./llm";

export interface SeoScores {
  title: number;
  description: number;
  hashtags: number;
  overall: number;
}

export interface SeoResult {
  titles: string[];
  recommendedTitle: string;
  description: string;
  hashtags: string[];
  platforms: Record<string, { hashtags: string[]; note: string }>;
  keywords: string[];
  thumbnailText: string;
  scores: SeoScores;
  analysis: { strengths: string[]; improvements: string[] };
  generatedBy: "local" | "llm";
}

const STOPWORDS = new Set(
  `a an the and or but if then than that this these those is are was were be been being am do does did doing have has had having i you he she it we they me him her them my your his their our its of in on at to for with from by about as into over after before between out up down off again further once here there when where why how all any both each few more most other some such no nor not only own same so too very can will just don should now`.split(
    /\s+/,
  ),
);

/** Words that carry no topical signal in a title. */
const GENERIC = new Set(
  `thing things stuff alright okay ok well yeah yes no way like really actually basically literally kind sort gonna wanna know think thought mean said says say tell talking talk video video clip clips people everyone somebody anybody nothing something anyone guy guys dude bro man girl watch look looking happened happen going got get gets one two three first last best worst good bad new big small lot much many made make today right sure okay post posts content part another whole thing.`.split(
    /\s+/,
  ),
);

const HYPE_OR_ADJECTIVE = new Set(
  ["insane","crazy","viral","best","worst","actual","real","whole","entire","little","huge","massive","good","bad","new","old","great","only"].map((w) => w),
);

const POWER_WORDS = [
  "insane",
  "nobody",
  "secret",
  "truth",
  "never",
  "always",
  "why",
  "how",
  "worst",
  "best",
  "mistake",
  "exposed",
  "finally",
  "impossible",
  "shocking",
  "brutal",
  "genius",
  "nobody",
  "everyone",
];

const CATEGORY_HOOKS: Record<MomentCategory, string[]> = {
  funny: ["The funniest thing I've heard all week", "He did not expect that reaction", "This had me laughing out loud"],
  reaction: ["His reaction says everything", "Nobody saw this coming", "Watch the exact second it lands"],
  gaming: ["This play broke the lobby", "The most clutch moment of the stream", "Watch this comeback in real time"],
  conversation: ["The conversation everyone is quoting", "This point changed the debate", "He explains it better than anyone else"],
  emotional: ["The moment the room went quiet", "This hit harder than expected", "Honestly, this one got emotional"],
  rage: ["He completely lost it", "The rage built up for minutes", "This is what a full meltdown looks like"],
  fact: ["I had no idea this was true", "This fact breaks people's brains", "The detail nobody ever mentions"],
  energy: ["The energy in this clip is unreal", "This escalated so fast", "Peak hype moment"],
  quote: ["This quote needs to be framed", "Words that actually land", "The most quotable line of the stream"],
  suspense: ["It gets worse every second", "Wait for what happens next", "The setup makes the ending brutal"],
};

const CATEGORY_TAGS: Record<MomentCategory, string[]> = {
  funny: ["funny", "comedy", "humor", "lol", "funnyclips"],
  reaction: ["reaction", "shocking", "unexpected", "viral"],
  gaming: ["gaming", "gamingclips", "clutch", "streamer", "twitch"],
  conversation: ["podcast", "podcastclips", "debate", "discussion"],
  emotional: ["emotional", "storytime", "wholesome", "real"],
  rage: ["rage", "gamerrage", "meltdown", "freakout"],
  fact: ["facts", "didyouknow", "learnontiktok", "knowledge"],
  energy: ["hype", "highlights", "energy", "livestream"],
  quote: ["quotes", "quoteoftheday", "inspiration", "mindset"],
  suspense: ["storytime", "suspense", "plottwist", "cliffhanger"],
};

const PLATFORM_NOTES: Record<string, string> = {
  "YouTube Shorts": "Shorts reward 3–5 hashtags; keep #shorts first in the description.",
  TikTok: "TikTok: 4–6 hashtags. One broad (#fyp) plus 3–4 niche tags performs best.",
  "Instagram Reels": "Reels: 5–8 hashtags, plus 2 keyword phrases inside the caption for search.",
  Facebook: "Facebook Reels: keep hashtags minimal — 2–4 usually win.",
};

export interface SeoInput {
  moment: Moment;
  sourceTitle: string;
  channel?: string | null;
  platform: "youtube" | "kick" | "upload";
  language?: string;
  useLlm?: boolean;
}

/* ------------------------------- helpers ---------------------------------- */

const titleCase = (input: string) =>
  input
    .split(/\s+/)
    .map((word, i) => {
      const lower = word.toLowerCase();
      if (i > 0 && ["a", "an", "the", "and", "but", "or", "of", "in", "on", "at", "to", "for", "with", "is", "it"].includes(lower))
        return lower;
      if (word.length <= 2 && word === word.toUpperCase()) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > max * 0.55 ? cut.slice(0, lastSpace) : cut).replace(/[,;:\-–—]$/, "").trim();
}

/** Strips filler so a spoken sentence reads like a written hook. */
function cleanHook(text: string): string {
  let out = text;
  const filler =
    /^(so|and|but|well|okay|ok|alright|right|um+|uh+|like|you know|i mean|honestly|basically|literally|here'?s the thing|here is the thing|the thing is|so here'?s the thing|so here is the thing)[,:\s]+/i;
  for (let i = 0; i < 4; i++) {
    const before = out;
    out = out.replace(filler, "");
    if (out === before) break;
  }
  out = out.replace(/^["'“”\s]+|["'“”\s]+$/g, "").replace(/\s+/g, " ").trim();
  if (!out) return "";
  out = out.charAt(0).toUpperCase() + out.slice(1);
  return truncate(out, 74);
}

function keyPhrases(text: string, limit = 8): string[] {
  const clean = text
    .toLowerCase()
    .replace(/[^a-z0-9\u0900-\u097F\u0C00-\u0C7F'\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const words = clean
    .split(" ")
    .filter(
      (w) =>
        w.length > 3 &&
        !STOPWORDS.has(w) &&
        !GENERIC.has(w) &&
        !HYPE_OR_ADJECTIVE.has(w) &&
        !POWER_WORDS.includes(w),
    );

  const unigrams = new Map<string, number>();
  const bigrams = new Map<string, number>();
  for (let i = 0; i < words.length; i++) {
    unigrams.set(words[i], (unigrams.get(words[i]) ?? 0) + 1);
    if (i < words.length - 1) {
      const bigram = `${words[i]} ${words[i + 1]}`;
      bigrams.set(bigram, (bigrams.get(bigram) ?? 0) + 1);
    }
  }

  const scored: Array<[string, number]> = [];
  for (const [gram, count] of bigrams) {
    if (count >= 2) scored.push([gram, 3 + count]);
  }
  for (const [word, count] of unigrams) scored.push([word, count]);
  scored.sort((a, b) => b[1] - a[1]);

  const seen = new Set<string>();
  const out: string[] = [];
  for (const [gram] of scored) {
    if (seen.has(gram)) continue;
    seen.add(gram);
    out.push(gram);
    if (out.length >= limit) break;
  }
  return out;
}

function scoreTitle(title: string, keywords: string[]): number {
  const lower = title.toLowerCase();
  let score = 42;
  const len = title.length;
  if (len >= 30 && len <= 68) score += 20;
  else if (len < 22) score -= 14;
  else if (len > 78) score -= 14;

  if (/\d/.test(title)) score += 6;
  if (title.includes("?") || title.includes(":")) score += 4;
  if (POWER_WORDS.some((w) => lower.includes(w))) score += 12;
  if (keywords.slice(0, 5).some((k) => lower.includes(k))) score += 10;
  if (/^(the|a|an)\b/i.test(title)) score -= 3;
  if (/[!]{2,}|[\u{1F300}-\u{1FAFF}]/u.test(title)) score -= 9;
  if (/\b(thing|stuff|alright|okay)\b/i.test(title)) score -= 8;
  if (/[,:–-]\s*$/.test(title)) score -= 6;
  if (/\b(viral|clickbait|must watch)\b/i.test(title)) score -= 5; // avoid empty hype
  return Math.max(8, Math.min(97, score));
}

/* ------------------------------ main entry -------------------------------- */

export async function generateSeo(input: SeoInput): Promise<SeoResult> {
  const keywords = keyPhrases(`${input.moment.transcript} ${input.sourceTitle}`, 10);
  const local = localSeo(input, keywords);
  if (!input.useLlm) return local;

  const llm = await chatJson<{
    titles?: string[];
    description?: string;
    hashtags?: string[];
    thumbnailText?: string;
    keywords?: string[];
  }>(
    [
      {
        role: "system",
        content:
          "You write metadata for short-form clips cut from livestreams and podcasts. " +
          "Be truthful — never claim something the transcript does not contain. No fake numbers, no invented drama. " +
          "Titles: 30–68 characters, curiosity-driven but accurate, no clickbait, no all-caps. " +
          "Descriptions: 240–420 characters, one keyword-rich sentence, a call to action, and a source credit line. " +
          'Reply with JSON only: {"titles":[8 strings],"description":string,"hashtags":[12 strings with leading #],"thumbnailText":string (max 4 words),"keywords":[8 strings]}',
      },
      {
        role: "user",
        content: `Category: ${CATEGORY_LABEL[input.moment.category]}
Source video: ${input.sourceTitle}${input.channel ? ` — channel: ${input.channel}` : ""} (${input.platform})
Clip length: ${Math.round(input.moment.duration)}s
Transcript: ${input.moment.transcript.slice(0, 1600)}`,
      },
    ],
    { maxTokens: 1400, temperature: 0.75 },
  );

  if (!llm?.titles?.length) return local;

  const titles = Array.from(
    new Set([...llm.titles.map((t) => String(t).trim()), ...local.titles].filter(Boolean)),
  ).slice(0, 10);
  const recommendedTitle =
    titles.map((t) => ({ t, s: scoreTitle(t, keywords) })).sort((a, b) => b.s - a.s)[0]?.t ??
    local.recommendedTitle;
  const hashtags = Array.from(
    new Set([...(llm.hashtags ?? []), ...local.hashtags].map((h) => (h.startsWith("#") ? h : `#${h}`))),
  ).slice(0, 18);
  const description = String(llm.description ?? local.description).slice(0, 1200);
  const scores = buildScores(titles, description, hashtags, keywords, input.moment);

  return {
    ...local,
    titles,
    recommendedTitle,
    description,
    hashtags,
    keywords: llm.keywords?.length ? llm.keywords.map(String) : keywords,
    thumbnailText: (llm.thumbnailText ?? local.thumbnailText).toUpperCase().slice(0, 34),
    scores: {
      title: Math.max(scores.title, local.scores.title),
      description: Math.max(scores.description, local.scores.description),
      hashtags: Math.max(scores.hashtags, local.scores.hashtags),
      overall: Math.max(scores.overall, local.scores.overall),
    },
    generatedBy: "llm",
  };
}

function localSeo(input: SeoInput, keywords: string[]): SeoResult {
  const { moment, sourceTitle, channel, platform } = input;
  const hook = cleanHook(moment.hook || moment.transcript.split(/[.!?]/)[0] || sourceTitle);
  const topic = keywords.find((k) => k.split(" ").length > 1) ?? "";
  const topicTitle = topic ? titleCase(truncate(topic, 34)) : "";
  const categoryHooks = CATEGORY_HOOKS[moment.category] ?? CATEGORY_HOOKS.conversation;
  const durationTag = `${Math.round(moment.duration)}s`;

  const candidates = [
    hook,
    hook.includes("?") ? hook : `${hook}?`,
    topicTitle ? `${topicTitle}: ${truncate(hook, 48)}` : "",
    categoryHooks[0],
    categoryHooks[1],
    topicTitle ? `Why ${topicTitle} changes everything` : "",
    topicTitle ? `The ${topicTitle} detail nobody talks about` : "",
    hook.length < 52 ? `${hook} — and it's not what you think` : "",
    `${truncate(sourceTitle, 40)} (${durationTag} clip)`,
    `${CATEGORY_LABEL[moment.category]}: ${truncate(hook, 40)}`,
    categoryHooks[2],
  ]
    .map((t) => t.trim())
    .filter((t) => t.length >= 18);

  const titles = dedupe(candidates).slice(0, 9);
  const recommendedTitle =
    titles.map((t) => ({ t, s: scoreTitle(t, keywords) })).sort((a, b) => b.s - a.s)[0]?.t ?? titles[0] ?? "Watch this clip";

  const sourceCredit =
    platform === "youtube"
      ? `Video: “${sourceTitle}”${channel ? ` by ${channel}` : ""} on YouTube`
      : platform === "kick"
        ? `Stream: “${sourceTitle}”${channel ? ` by ${channel}` : ""} on Kick`
        : `Source: “${sourceTitle}”`;

  const summary = truncate(cleanHook(moment.transcript.replace(/\s+/g, " ")), 240);
  const description = [
    summary || hook,
    "",
    `${moment.hook ? `Around ${formatStamp(moment.start)}: ${truncate(moment.hook, 120)}` : ""}`.trim(),
    `${sourceCredit}. Clip cut and captioned with Clipwave AI — captions are automatic, so minor transcription slips are possible.`,
    "",
    `👉 Watch the full ${platform === "youtube" ? "video" : "stream"} and follow for more ${CATEGORY_LABEL[
      moment.category
    ].toLowerCase()}s.`,
    keywords.length ? `Topics: ${keywords.slice(0, 6).join(", ")}` : "",
  ]
    .filter((line, i, arr) => !(line === "" && arr[i - 1] === ""))
    .join("\n");

  const baseTags = [
    ...CATEGORY_TAGS[moment.category],
    ...keywords.slice(0, 4).map((k) => k.replace(/\s+/g, "")),
    platform === "kick" ? "kickstream" : platform === "youtube" ? "youtube" : "contentcreator",
  ];
  const hashtags = dedupe(baseTags)
    .map((t) => `#${t.replace(/[^a-zA-Z0-9_]/g, "")}`)
    .filter((t) => t.length > 2)
    .slice(0, 14);

  const platforms: Record<string, { hashtags: string[]; note: string }> = {
    "YouTube Shorts": {
      hashtags: ["#shorts", "#youtubeshorts", ...hashtags.slice(0, 3), "#subscribe"].map(normaliseTag),
      note: PLATFORM_NOTES["YouTube Shorts"],
    },
    TikTok: {
      hashtags: ["#fyp", "#foryou", ...hashtags.slice(0, 4)].map(normaliseTag),
      note: PLATFORM_NOTES.TikTok,
    },
    "Instagram Reels": {
      hashtags: ["#reels", "#reelsinstagram", ...hashtags.slice(0, 5)].map(normaliseTag),
      note: PLATFORM_NOTES["Instagram Reels"],
    },
    Facebook: {
      hashtags: ["#reels", "#facebookreels", ...hashtags.slice(0, 3)].map(normaliseTag),
      note: PLATFORM_NOTES.Facebook,
    },
  };

  const thumbnailText = pickThumbnailText(hook, keywords);
  const scores = buildScores(titles, description, hashtags, keywords, moment);

  return {
    titles,
    recommendedTitle,
    description,
    hashtags,
    platforms,
    keywords,
    thumbnailText,
    scores,
    analysis: buildAnalysis(moment, titles, hashtags, keywords),
    generatedBy: "local",
  };
}

const normaliseTag = (tag: string) => (tag.startsWith("#") ? tag : `#${tag}`);

function formatStamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function pickThumbnailText(hook: string, keywords: string[]): string {
  const fromHook = hook
    .replace(/[^\w\s'!?]/g, "")
    .split(/\s+/)
    .filter(
      (w) =>
        w.length > 2 &&
        !STOPWORDS.has(w.toLowerCase()) &&
        !GENERIC.has(w.toLowerCase()) &&
        !HYPE_OR_ADJECTIVE.has(w.toLowerCase()),
    );

  const fromKeywords = keywords.join(" ").split(/\s+/).filter((w) => w.length > 3);

  const pool = [...fromHook.slice(0, 3), ...fromKeywords.slice(0, 2)];
  const words = dedupe(pool).slice(0, 3);
  return (words.join(" ") || "WATCH THIS").toUpperCase().slice(0, 30);
}

function buildScores(
  titles: string[],
  description: string,
  hashtags: string[],
  keywords: string[],
  moment: Moment,
): SeoScores {
  const bestTitle = Math.max(...titles.map((t) => scoreTitle(t, keywords)), 10);

  const words = description.split(/\s+/).length;
  let descriptionScore = 34;
  if (words >= 35) descriptionScore += 14;
  if (words >= 55) descriptionScore += 10;
  if (words >= 80) descriptionScore += 6;
  if (words > 200) descriptionScore -= 10;
  if (keywords.slice(0, 5).some((k) => description.toLowerCase().includes(k))) descriptionScore += 12;
  if (/(source|full video|full stream)/i.test(description)) descriptionScore += 8;
  if (/(👉|follow|subscribe|comment|share)/i.test(description)) descriptionScore += 10;
  if (/\n\n/.test(description)) descriptionScore += 4;
  descriptionScore += Math.min(8, Math.round(moment.breakdown.hook / 14));

  let hashtagScore = 36;
  if (hashtags.length >= 5) hashtagScore += 14;
  if (hashtags.length >= 9) hashtagScore += 12;
  if (hashtags.length > 18) hashtagScore -= 12;
  if (hashtags.some((h) => CATEGORY_TAGS[moment.category].includes(h.replace("#", "")))) hashtagScore += 14;
  if (hashtags.some((h) => ["#fyp", "#reels", "#shorts"].includes(h))) hashtagScore += 8;
  if (keywords.slice(0, 4).some((k) => hashtags.some((h) => h.toLowerCase().includes(k.replace(/\s+/g, ""))))) hashtagScore += 10;

  const clamp = (v: number) => Math.max(5, Math.min(96, Math.round(v)));
  const title = clamp(bestTitle);
  const d = clamp(descriptionScore);
  const h = clamp(hashtagScore);
  return {
    title,
    description: d,
    hashtags: h,
    overall: clamp(title * 0.45 + d * 0.28 + h * 0.27),
  };
}

function buildAnalysis(
  moment: Moment,
  titles: string[],
  hashtags: string[],
  keywords: string[],
): { strengths: string[]; improvements: string[] } {
  const strengths: string[] = [];
  const improvements: string[] = [];
  if (moment.breakdown.hook >= 55) strengths.push("The opening line works as a hook on its own.");
  if (moment.breakdown.context >= 65) strengths.push("Complete thought — nothing is cut mid-sentence.");
  if (moment.breakdown.humor >= 45) strengths.push("Humour cues give it a shareable edge.");
  if (keywords.length >= 5) strengths.push(`Clear topical keywords: ${keywords.slice(0, 3).join(", ")}.`);
  if (titles.some((t) => t.includes("?"))) strengths.push("A question-style title invites comments.");

  if (moment.breakdown.retention < 60) improvements.push("Trim 0.3–0.5s of dead air between lines to tighten pacing.");
  if (titles.every((t) => t.length > 70)) improvements.push("Shorten the title below 68 characters for mobile.");
  if (hashtags.length > 15) improvements.push("Trim to 10 hashtags — relevance beats volume.");
  if (!/\d/.test(moment.transcript)) improvements.push("Add one concrete detail or number to the title for CTR.");
  if (!strengths.length) strengths.push("Clean audio and a complete narrative arc.");
  return { strengths, improvements: improvements.slice(0, 3) };
}

function dedupe(list: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of list) {
    const key = item.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item.trim());
  }
  return out;
}
