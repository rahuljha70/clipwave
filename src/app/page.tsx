import { getSessionUser } from "@/lib/auth";
import { MarketingNav } from "@/components/marketing/nav";
import { Hero } from "@/components/marketing/hero";
import { Features } from "@/components/marketing/features";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { DemoSection } from "@/components/marketing/demo-section";
import { PricingSection } from "@/components/marketing/pricing";
import { Faq } from "@/components/marketing/faq";
import { CtaBand, Footer } from "@/components/marketing/footer";
import { AdSenseUnit } from "@/components/ads/adsense-guard";

export default async function LandingPage() {
  const user = await getSessionUser();
  const authed = Boolean(user);

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <MarketingNav authed={authed} />
      <main>
        <Hero authed={authed} />
        <HowItWorks />
        <Features />
        <AdSenseUnit />
        <DemoSection />
        <PricingSection />
        <Faq />
        <CtaBand authed={authed} />
      </main>
      <Footer />
    </div>
  );
}
