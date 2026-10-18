import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { STYLES, STYLE_MAP } from "@/data/styles";
import { PIECES } from "@/data/pieces";
import type { StyleSlug } from "@/lib/types";
import { img } from "@/lib/url";
import Feed from "@/components/Feed";
import Reveal from "@/components/Reveal";

export function generateStaticParams() {
  return STYLES.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: PageProps<"/styles/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const s = STYLE_MAP[slug as StyleSlug];
  return s ? { title: s.name, description: s.definition } : {};
}

export default async function StylePage({ params }: PageProps<"/styles/[slug]">) {
  const { slug } = await params;
  const style = STYLE_MAP[slug as StyleSlug];
  if (!style) notFound();
  const pieces = PIECES.filter((p) => p.styles.includes(style.slug));

  return (
    <>
      <section className="relative h-[70svh] min-h-[480px] overflow-hidden bg-ink">
        <Image
          src={img(style.cover)}
          alt={style.name}
          fill
          priority
          sizes="100vw"
          className="object-cover object-[50%_25%]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-black/20" />
        <div className="absolute inset-x-0 bottom-0 px-4 pb-10 text-white md:px-8 md:pb-14">
          <Reveal>
            <p className="eyebrow !text-white/70">
              Style · {style.trend.direction}
            </p>
            <h1 className="font-serif mt-2 text-[14vw] leading-[0.92] tracking-[-0.02em] md:text-[7vw]">
              {style.name}
            </h1>
            <p className="font-serif mt-3 text-2xl italic text-white/85 md:text-3xl">{style.tagline}</p>
          </Reveal>
        </div>
      </section>
      <section className="mx-auto grid max-w-[1800px] gap-8 px-4 py-12 md:grid-cols-12 md:px-8 md:py-16">
        <Reveal className="md:col-span-7">
          <p className="eyebrow">Definition</p>
          <p className="mt-3 max-w-2xl text-lg leading-relaxed md:text-2xl">{style.definition}</p>
        </Reveal>
        <Reveal delay={0.1} className="md:col-span-5">
          <p className="eyebrow">Trend reading</p>
          <p className="mt-3 text-[15px] leading-relaxed text-ink-2">{style.trend.note}</p>
        </Reveal>
      </section>
      <Suspense fallback={<div className="h-[60vh]" />}>
        <Feed pieces={pieces} lockedStyle={style.slug} />
      </Suspense>
    </>
  );
}
