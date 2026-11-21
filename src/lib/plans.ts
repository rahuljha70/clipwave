/** Plan catalogue + entitlement rules. Enforced server-side in /lib/entitlements.ts. */

export type PlanId = "free" | "pro" | "ultimate";
export type Aspect = "9:16" | "16:9" | "1:1";

export interface PlanLimits {
  id: PlanId;
  name: string;
  priceMonthly: number;
  tagline: string;
  /** Processing minutes included per calendar month. */
  minutesPerMonth: number;
  clipsPerProject: number;
  maxResolution: 720 | 1080;
  maxFps: 30 | 60;
  watermark: boolean;
  subtitleStyles: string[];
  maxSourceMinutes: number;
  /** Worker queue priority (higher runs first). */
  priority: number;
  features: string[];
}

const BASE_STYLES = ["minimal", "podcast"];

export const PLANS: Record<PlanId, PlanLimits> = {
  free: {
    id: "free",
    name: "Free",
    priceMonthly: 0,
    tagline: "Try the full pipeline on short videos.",
    minutesPerMonth: 30,
    clipsPerProject: 5,
    maxResolution: 720,
    maxFps: 30,
    watermark: true,
    subtitleStyles: BASE_STYLES,
    maxSourceMinutes: 45,
    priority: 0,
    features: [
      "30 processing minutes / month",
      "5 AI clips per project",
      "Basic animated subtitles",
      "720p export · 9:16 / 16:9 / 1:1",
      "SRT subtitle export",
    ],
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceMonthly: 19,
    tagline: "For creators posting every single day.",
    minutesPerMonth: 300,
    clipsPerProject: 30,
    maxResolution: 1080,
    maxFps: 30,
    watermark: false,
    subtitleStyles: [...BASE_STYLES, "mrbeast", "bold", "karaoke"],
    maxSourceMinutes: 180,
    priority: 5,
    features: [
      "300 processing minutes / month",
      "30 AI clips per project",
      "Premium animated subtitles (MrBeast, karaoke)",
      "1080p export · no watermark",
      "Advanced AI editing + face tracking",
      "Thumbnail generator",
    ],
  },
  ultimate: {
    id: "ultimate",
    name: "Ultimate",
    priceMonthly: 49,
    tagline: "Studios, agencies and high-volume channels.",
    minutesPerMonth: 1000,
    clipsPerProject: 100,
    maxResolution: 1080,
    maxFps: 60,
    watermark: false,
    subtitleStyles: [...BASE_STYLES, "mrbeast", "bold", "karaoke", "gaming"],
    maxSourceMinutes: 600,
    priority: 10,
    features: [
      "1,000 processing minutes / month",
      "100 AI clips per project",
      "All subtitle styles + 60 FPS export",
      "Priority processing queue",
      "Advanced AI tools & batch export",
      "API access & team seats",
    ],
  },
};

export const PLAN_ORDER: PlanId[] = ["free", "pro", "ultimate"];

export function getPlan(id: string | null | undefined): PlanLimits {
  return PLANS[(id as PlanId) in PLANS ? (id as PlanId) : "free"];
}

/** Admins always receive the complete feature set, regardless of their stored plan. */
export function getEffectivePlan(id: string | null | undefined, isAdmin = false): PlanLimits {
  return isAdmin ? PLANS.ultimate : getPlan(id);
}

export const CLIP_LENGTHS = [15, 30, 45, 60, 90] as const;
export type ClipLength = (typeof CLIP_LENGTHS)[number];

export const SUBTITLE_STYLES = [
  { id: "mrbeast", name: "MrBeast", blurb: "Huge word-by-word pop with heavy outline" },
  { id: "gaming", name: "Gaming", blurb: "Chunky caps, neon highlight, top tilt" },
  { id: "podcast", name: "Podcast", blurb: "Two-line clean captions, speaker tag" },
  { id: "minimal", name: "Minimal", blurb: "Small, elegant, high readability" },
  { id: "bold", name: "Bold Viral", blurb: "Short stacked lines, punch-in scale" },
  { id: "karaoke", name: "Karaoke", blurb: "Word-by-word color fill timing" },
] as const;

export const ASPECTS: { id: Aspect; name: string; platforms: string }[] = [
  { id: "9:16", name: "Vertical", platforms: "Shorts · TikTok · Reels" },
  { id: "16:9", name: "Landscape", platforms: "YouTube · X · Facebook" },
  { id: "1:1", name: "Square", platforms: "Feed · LinkedIn" },
];
