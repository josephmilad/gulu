import Image from "next/image";
import { EDITORIAL } from "@/data/pieces";
import { img } from "@/lib/url";
import Reveal from "./Reveal";

export default function Manifesto() {
  const [a, b] = EDITORIAL.racks;
  return (
    <section className="border-t hairline">
      <div className="mx-auto grid max-w-[1800px] gap-10 px-4 py-16 md:grid-cols-12 md:gap-8 md:px-8 md:py-28">
        <Reveal className="md:col-span-5">
          <p className="eyebrow">How it works</p>
          <h2 className="font-serif mt-3 text-4xl leading-[1.02] tracking-tight md:text-6xl">
            Low hype.
            <br />
            High regard.
          </h2>
          <p className="mt-6 max-w-md text-[15px] leading-relaxed text-ink-2">
            Our model reads reviews, forums, resale data and trend indices to find pieces that the
            people who know a category rate highly, but that the algorithm has not flattened yet.
            Every piece carries a Niche Score and a line on how it relates to what is trending now.
          </p>
          <ul className="mt-8 space-y-3 text-[13px]">
            {[
              ["01", "Recognition", "Rated by people who know the category"],
              ["02", "Under the radar", "Low mainstream volume, no dupe culture"],
              ["03", "Longevity", "Relevant across many seasons"],
              ["04", "Craft", "Material, construction and origin"],
            ].map(([n, t, d]) => (
              <li key={n} className="flex gap-4 border-t hairline pt-3">
                <span className="w-6 tabular-nums text-muted">{n}</span>
                <span className="w-32 shrink-0">{t}</span>
                <span className="text-ink-2">{d}</span>
              </li>
            ))}
          </ul>
        </Reveal>
        <div className="grid grid-cols-2 gap-3 md:col-span-7 md:gap-5">
          <Reveal className="relative aspect-[3/4] overflow-hidden bg-[#ebe8e2] md:mt-16">
            <Image src={img(a.src, 900)} alt={a.alt} fill sizes="30vw" className="object-cover" />
          </Reveal>
          <Reveal delay={0.1} className="relative aspect-[3/4] overflow-hidden bg-[#ebe8e2]">
            <Image src={img(b.src, 900)} alt={b.alt} fill sizes="30vw" className="object-cover" />
          </Reveal>
        </div>
      </div>
    </section>
  );
}
