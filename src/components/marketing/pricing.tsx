import { SectionHeading } from "@/components/ui/card";
import { PricingTable } from "@/components/pricing-table";

export function PricingSection() {
  return (
    <section id="pricing" className="relative mx-auto w-full max-w-7xl px-5 py-20 sm:px-8 sm:py-24">
      <SectionHeading
        center
        eyebrow="Pricing"
        title="Start free. Upgrade when the clips are working."
        description="Processing minutes are metered by the length of the source you import — not by renders. Every plan can export 9:16, 16:9 and 1:1."
      />
      <div className="mt-12">
        <PricingTable />
      </div>
      <p className="mt-6 text-center text-[12px] text-white/35">
        Prices in USD. Cancel anytime — the current month stays active. Taxes handled at checkout.
      </p>
    </section>
  );
}
