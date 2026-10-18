import type { Metadata } from "next";
import Reveal from "@/components/Reveal";

export const metadata: Metadata = { title: "About" };

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-24 md:px-8 md:pt-32">
      <Reveal>
        <p className="eyebrow">About</p>
        <h1 className="font-serif mt-2 text-4xl leading-[1.02] tracking-tight md:text-6xl">
          We find the pieces the algorithm skipped.
        </h1>
      </Reveal>
      <div className="mt-10 space-y-10 text-[15px] leading-relaxed text-ink-2">
        <Reveal>
          <p>
            niche is a discovery feed, not a shop. An AI model reads reviews, forums, resale data
            and trend indices to surface clothing, shoes and accessories that people who know a
            category rate highly, but that have not been flattened into a trend yet. A human
            approves every piece before it appears.
          </p>
        </Reveal>
        <Reveal id="score">
          <h2 className="font-serif text-2xl text-ink">The Niche Score</h2>
          <p className="mt-3">
            Four signals, weighted: recognition (35%), how far under the radar it sits (30%),
            craft (20%) and longevity (15%). A piece needs a score of 60 or more and strong
            recognition to make the feed. We would rather show you less.
          </p>
        </Reveal>
        <Reveal id="disclosure">
          <h2 className="font-serif text-2xl text-ink">Affiliate disclosure</h2>
          <p className="mt-3">
            Every piece links to the platform that sells it. Some of those links may earn us a
            commission at no cost to you. Commission never affects whether a piece is included or
            how it is scored.
          </p>
        </Reveal>
        <Reveal id="imagery">
          <h2 className="font-serif text-2xl text-ink">Imagery</h2>
          <p className="mt-3">
            During our preview, pieces are illustrated with editorial photography under the
            Unsplash licence rather than exact product shots. Product imagery from brands and
            retailers will replace it as feeds are connected, with attribution on each piece.
          </p>
        </Reveal>
        <Reveal id="privacy">
          <h2 className="font-serif text-2xl text-ink">Privacy</h2>
          <p className="mt-3">
            We use privacy-friendly analytics to understand what people scroll, open and click
            through. No accounts, no tracking across sites, no selling of data.
          </p>
        </Reveal>
      </div>
    </div>
  );
}
