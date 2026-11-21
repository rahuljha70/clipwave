"use client";

import Script from "next/script";
import { useEffect, useState } from "react";

const clientId = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID?.trim() ?? "";
const validClientId = /^ca-pub-\d{10,20}$/.test(clientId);
const gateEnabled =
  validClientId &&
  (process.env.NEXT_PUBLIC_ADBLOCK_GATE === "true" ||
    (process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_ADBLOCK_GATE !== "false"));

type AdsState = "checking" | "ready" | "blocked";

export function AdSenseGuard({ children }: { children: React.ReactNode }) {
  const [adsState, setAdsState] = useState<AdsState>(gateEnabled ? "checking" : "ready");

  useEffect(() => {
    if (!gateEnabled) return;

    // Some extensions silently cancel the request instead of firing onError.
    const timer = window.setTimeout(() => {
      setAdsState((current) => (current === "checking" ? "blocked" : current));
    }, 15_000);
    return () => window.clearTimeout(timer);
  }, []);

  const retry = () => window.location.reload();

  return (
    <>
      {validClientId ? (
        <Script
          async
          crossOrigin="anonymous"
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(clientId)}`}
          strategy="afterInteractive"
          onLoad={() => {
            if (gateEnabled) setAdsState("ready");
          }}
          onError={() => {
            if (gateEnabled) setAdsState("blocked");
          }}
        />
      ) : null}

      {adsState === "blocked" ? (
        <main className="grid min-h-screen place-items-center px-5 py-12">
          <section
            aria-labelledby="ads-required-title"
            className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#111426]/95 p-7 shadow-2xl shadow-black/40 sm:p-9"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-300">Clipwave</p>
            <h1 id="ads-required-title" className="mt-4 font-display text-2xl font-bold text-white">
              Please allow ads to continue
            </h1>
            <p className="mt-3 text-sm leading-6 text-white/65">
              Clipwave uses advertising to support the service. We couldn’t load the ad service. If you use an ad
              blocker or privacy extension, allow ads for this site and reload the page.
            </p>
            <button
              type="button"
              onClick={retry}
              className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-violet-500 px-5 text-sm font-semibold text-white transition hover:bg-violet-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
            >
              Reload Clipwave
            </button>
          </section>
        </main>
      ) : adsState === "checking" ? (
        <main className="grid min-h-screen place-items-center bg-[#070812] px-5 text-sm text-white/60">
          Loading Clipwave…
        </main>
      ) : (
        children
      )}
    </>
  );
}

export function AdSenseUnit({ slot }: { slot?: string }) {
  const adSlot = (slot ?? process.env.NEXT_PUBLIC_ADSENSE_HOME_SLOT ?? "").trim();
  if (!validClientId || !/^\d+$/.test(adSlot)) return null;
  return <AdUnit client={clientId} slot={adSlot} />;
}

function AdUnit({ client, slot }: { client: string; slot: string }) {
  useEffect(() => {
    try {
      const adsWindow = window as Window & { adsbygoogle?: unknown[] };
      const queue = (adsWindow.adsbygoogle = adsWindow.adsbygoogle ?? []);
      queue.push({});
    } catch {
      // The page-level gate handles a blocked AdSense script when enabled.
    }
  }, []);

  return (
    <aside className="mx-auto my-8 w-full max-w-5xl px-5" aria-label="Advertisement">
      <p className="mb-2 text-center text-[10px] font-medium uppercase tracking-[0.18em] text-white/30">
        Advertisement
      </p>
      <ins
        className="adsbygoogle block min-h-[100px] w-full overflow-hidden rounded-xl"
        style={{ display: "block" }}
        data-ad-client={client}
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </aside>
  );
}
