import type { Metadata } from "next";
import Link from "next/link";
import Media from "@/components/Media";
import { DIRECTION_LABEL, RANKED, STYLES } from "@/lib/catalog";

export const metadata: Metadata = { title: "Styles" };

export default function StylesPage() {
  return (
    <div className="wrap sec">
      <div className="head">
        <div>
          <h2>Shop by style</h2>
          <p>Archetypes, not trends. Each has a written definition and a live trend reading.</p>
        </div>
      </div>
      <div className="grid" style={{ paddingTop: 8 }}>
        {STYLES.map((s, i) => {
          const count = RANKED.filter((p) => p.styles.includes(s.slug)).length;
          return (
            <Link key={s.slug} href={`/styles/${s.slug}`} className="tile card" style={{ flex: "none", ["--i" as string]: i % 8 }}>
              <Media src={s.cover} alt={s.name} sizes="(max-width: 700px) 50vw, 25vw" priority={i < 4} />
              <div className="shade" />
              <div className="t">
                <span className="trend">{DIRECTION_LABEL[s.trend.direction]}</span>
                <b>{s.name}</b>
                <span>{s.tagline} · {count} pieces</span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
