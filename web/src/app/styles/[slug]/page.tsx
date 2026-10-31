import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { STYLES, STYLE_MAP } from "@/data/styles";
import { DIRECTION_LABEL, RANKED } from "@/lib/catalog";
import type { StyleSlug } from "@/lib/types";
import ShopGrid from "@/components/ShopGrid";

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
  const pieces = RANKED.filter((p) => p.styles.includes(style.slug));

  return (
    <>
      <div className="wrap" style={{ paddingTop: 4 }}>
        <section className="slide active" style={{ display: "block", aspectRatio: "auto", height: "min(62vh, 520px)", minHeight: 360 }}>
          <div className="media loaded" style={{ position: "absolute", inset: 0 }}>
            <Image src={style.cover} alt={style.name} fill priority sizes="100vw" style={{ objectFit: "cover", objectPosition: "50% 25%", opacity: 1 }} />
          </div>
          <div className="shade" />
          <div className="copy">
            <span className="tag">{DIRECTION_LABEL[style.trend.direction]}</span>
            <h3 style={{ fontSize: "clamp(48px, 9vw, 96px)" }}>{style.name}</h3>
            <p style={{ maxWidth: "46ch" }}>{style.definition}</p>
          </div>
        </section>
      </div>
      <div className="wrap sec">
        <div className="box" style={{ maxWidth: 760 }}>
          <h4>Trend reading</h4>
          <p className="sub">{style.trend.note}</p>
        </div>
      </div>
      <Suspense fallback={<div style={{ minHeight: "60vh" }} />}>
        <ShopGrid pieces={pieces} lockedStyle={style.slug} />
      </Suspense>
    </>
  );
}
