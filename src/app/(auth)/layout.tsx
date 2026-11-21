import Link from "next/link";
import { Captions, CheckCircle2, Sparkles, Zap } from "lucide-react";
import { Logo } from "@/components/brand";

const POINTS = [
  { icon: Sparkles, text: "Finds the moments worth clipping — not just loud ones" },
  { icon: Captions, text: "Word-by-word animated captions in English, Hindi & Nepali" },
  { icon: Zap, text: "Vertical reframe with face tracking, rendered by FFmpeg" },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="animate-aurora absolute -left-32 top-0 size-[36rem] rounded-full bg-violet-600/25 blur-[120px]" />
        <div className="animate-aurora absolute -right-24 bottom-0 size-[32rem] rounded-full bg-electric-500/20 blur-[120px]" />
        <div className="absolute inset-0 grid-lines opacity-40 [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" />
      </div>

      <div className="hidden w-1/2 flex-col justify-between border-r border-white/8 bg-ink-950/40 p-12 backdrop-blur-sm lg:flex">
        <Link href="/">
          <Logo size={38} />
        </Link>

        <div className="max-w-md">
          <h2 className="font-display text-3xl font-bold leading-tight tracking-tight text-white">
            Turn a 3-hour stream into{" "}
            <span className="gradient-text">a week of shorts</span>.
          </h2>
          <p className="mt-4 text-[14px] leading-relaxed text-white/55">
            Clipwave watches the whole video, scores every candidate moment, and hands you finished
            vertical clips with captions and metadata already done.
          </p>

          <div className="mt-8 space-y-3.5">
            {POINTS.map((point) => (
              <div key={point.text} className="flex items-start gap-3">
                <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/6 text-violet-200">
                  <point.icon className="size-3.5" />
                </span>
                <span className="text-[13px] leading-relaxed text-white/60">{point.text}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="glass max-w-md rounded-2xl p-4">
          <p className="text-[13px] leading-relaxed text-white/70">
            “I used to spend three hours scrubbing a VOD for clips. Now I paste the link and edit the
            8 it finds in about ten minutes.”
          </p>
          <div className="mt-3 flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-electric-500 text-[11px] font-bold text-white">
              AR
            </span>
            <div>
              <p className="text-[12px] font-medium text-white">Aayush R.</p>
              <p className="text-[11px] text-white/40">Gaming creator · 240k subs</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex w-full flex-col lg:w-1/2">
        <div className="flex items-center justify-between p-6 lg:hidden">
          <Link href="/">
            <Logo />
          </Link>
          <Link href="/" className="text-[12.5px] text-white/50 hover:text-white">
            Back to site
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-center px-5 py-8 sm:px-10">
          <div className="w-full max-w-[420px]">{children}</div>
        </div>
        <div className="hidden items-center justify-center gap-2 p-6 text-[11.5px] text-white/30 lg:flex">
          <CheckCircle2 className="size-3.5" /> Secure httpOnly sessions · no API keys in the browser
        </div>
      </div>
    </div>
  );
}
