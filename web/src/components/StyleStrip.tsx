import Image from "next/image";
import Link from "next/link";
import { STYLES } from "@/data/styles";
import { img } from "@/lib/url";
import Reveal from "./Reveal";

export default function StyleStrip() {
  return (
    <section className="mx-auto max-w-[1800px] px-4 py-16 md:px-8 md:py-24">
      <Reveal className="flex items-end justify-between">
        <div>
          <p className="eyebrow">Browse by style</p>
          <h2 className="font-serif mt-2 text-3xl tracking-tight md:text-5xl">Ten ways to dress quietly.</h2>
        </div>
        <Link href="/styles" className="u-link hidden text-[13px] md:inline">
          All styles
        </Link>
      </Reveal>
      <div className="no-scrollbar -mx-4 mt-8 flex snap-x gap-3 overflow-x-auto px-4 md:-mx-8 md:mt-12 md:gap-5 md:px-8">
        {STYLES.map((s, i) => (
          <Reveal key={s.slug} delay={i * 0.04} className="w-[68vw] shrink-0 snap-start sm:w-[42vw] md:w-[26vw] lg:w-[19vw]">
            <Link href={`/styles/${s.slug}`} className="group block">
              <div className="relative aspect-[4/5] w-full overflow-hidden bg-[#ebe8e2]">
                <Image
                  src={img(s.cover)}
                  alt={s.name}
                  fill
                  sizes="(max-width: 768px) 68vw, 20vw"
                  className="object-cover transition-transform duration-[1200ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.05]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-4 text-white">
                  <p className="font-serif text-2xl">{s.name}</p>
                  <p className="text-[12px] text-white/75">{s.tagline}</p>
                </div>
              </div>
            </Link>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
