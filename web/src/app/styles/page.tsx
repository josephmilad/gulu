import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { STYLES } from "@/data/styles";
import { PIECES } from "@/data/pieces";
import { img } from "@/lib/url";
import Reveal from "@/components/Reveal";

export const metadata: Metadata = { title: "Styles" };

const ARROW = { rising: "↗", steady: "→", cooling: "↘" } as const;

export default function StylesPage() {
  return (
    <div className="mx-auto max-w-[1800px] px-4 pb-24 pt-24 md:px-8 md:pt-32">
      <Reveal>
        <p className="eyebrow">Styles</p>
        <h1 className="font-serif mt-2 max-w-[16ch] text-4xl leading-[1.02] tracking-tight md:text-7xl">
          Archetypes, not trends.
        </h1>
        <p className="mt-6 max-w-lg text-[15px] leading-relaxed text-ink-2">
          Each style has a written definition our model classifies against, and a weekly trend
          reading so you can see what is rising, holding, or cooling.
        </p>
      </Reveal>
      <div className="mt-12 grid gap-x-5 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
        {STYLES.map((s, i) => {
          const count = PIECES.filter((p) => p.styles.includes(s.slug)).length;
          return (
            <Reveal key={s.slug} delay={(i % 3) * 0.06}>
              <Link href={`/styles/${s.slug}`} className="group block">
                <div className="relative aspect-[4/5] w-full overflow-hidden bg-[#ebe8e2]">
                  <Image
                    src={img(s.cover)}
                    alt={s.name}
                    fill
                    sizes="(max-width: 640px) 100vw, 33vw"
                    className="object-cover transition-transform duration-[1200ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.04]"
                  />
                </div>
                <div className="mt-4 flex items-baseline justify-between">
                  <h2 className="font-serif text-3xl">{s.name}</h2>
                  <span className="text-[12px] text-muted">
                    {ARROW[s.trend.direction]} {s.trend.direction} · {count} pieces
                  </span>
                </div>
                <p className="mt-2 text-[14px] leading-relaxed text-ink-2">{s.definition}</p>
              </Link>
            </Reveal>
          );
        })}
      </div>
    </div>
  );
}
