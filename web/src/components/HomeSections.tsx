"use client";

import { useRef } from "react";
import { CATEGORY_IMAGE, DIRECTION_LABEL, STYLES, USED_CATEGORIES, readFilters, type RankedPiece } from "@/lib/catalog";
import { useShop } from "@/lib/useShop";
import Media from "./Media";
import PieceCard from "./PieceCard";
import { ChevronLeft, ChevronRight } from "./Icons";

export function SectionHead({ title, sub, action }: { title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div className="head">
      <div>
        <h2>{title}</h2>
        {sub && <p>{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function CategoryBubbles() {
  const { params, update } = useShop();
  const active = readFilters(params).cats;
  return (
    <section className="wrap sec" aria-label="Shop by category">
      <SectionHead title="Shop by category" />
      <div className="bubbles">
        {USED_CATEGORIES.map((c) => {
          const on = active.length === 1 && active[0] === c;
          return (
            <button
              key={c}
              type="button"
              className={`bubble${on ? " on" : ""}`}
              onClick={() => update({ category: on ? null : c, p: null }, { toGrid: true })}
            >
              <Media src={CATEGORY_IMAGE[c]} alt={c} sizes="96px" />
              <span>{c}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function Rail({ title, sub, pieces, sort }: { title: string; sub: string; pieces: RankedPiece[]; sort: string }) {
  const { update } = useShop();
  const rail = useRef<HTMLDivElement>(null);
  const scroll = (dir: number) => rail.current?.scrollBy({ left: dir * rail.current.clientWidth * 0.8, behavior: "smooth" });
  return (
    <section className="wrap sec">
      <SectionHead
        title={title}
        sub={sub}
        action={
          <button type="button" className="more" onClick={() => update({ sort, p: null }, { toGrid: true })}>
            See all <ChevronRight />
          </button>
        }
      />
      <div className="rail-wrap">
        <button type="button" className="arrow l" aria-label="Scroll left" onClick={() => scroll(-1)}>
          <ChevronLeft />
        </button>
        <div className="rail" ref={rail}>
          {pieces.map((p, i) => (
            <PieceCard key={p.slug} piece={p} index={i} />
          ))}
        </div>
        <button type="button" className="arrow r" aria-label="Scroll right" onClick={() => scroll(1)}>
          <ChevronRight />
        </button>
      </div>
    </section>
  );
}

export function StyleTiles() {
  const { update } = useShop();
  return (
    <section className="wrap sec" id="styles">
      <SectionHead title="Shop by style" sub={`${STYLES.length} archetypes, each with a live trend reading`} />
      <div className="tiles">
        {STYLES.map((s) => (
          <button key={s.slug} type="button" className="tile" onClick={() => update({ style: s.slug, category: null, p: null }, { toGrid: true })}>
            <Media src={s.cover} alt={s.name} sizes="(max-width: 640px) 62vw, 20vw" />
            <div className="shade" />
            <div className="t">
              <span className="trend">{DIRECTION_LABEL[s.trend.direction]}</span>
              <b>{s.name}</b>
              <span>{s.tagline}</span>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

export function HowItWorks() {
  const rows = [
    ["35%", "Recognition", "Rated highly by people who know the category"],
    ["30%", "Under the radar", "Low mainstream volume and no dupe culture"],
    ["20%", "Craft", "Material, construction and origin"],
    ["15%", "Longevity", "Still relevant after many seasons"],
  ];
  return (
    <section className="wrap sec" id="how">
      <SectionHead title="How the niche ranking works" />
      <p className="intro">
        An AI model reads reviews, forums, resale data and trend indices. It looks for pieces that people who know a
        category rate highly, but that the algorithm has not flattened yet. A person approves every piece before it appears.
      </p>
      <div className="how">
        {rows.map(([w, t, d]) => (
          <div key={t}>
            <b>{w}</b>
            <span>{t}</span>
            <p>{d}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
