"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import type { Piece } from "@/lib/types";
import { nicheScore } from "@/lib/types";
import { img } from "@/lib/url";
import { STYLE_MAP } from "@/data/styles";
import { similarPieces } from "@/data/pieces";
import NicheScore from "./NicheScore";

function SignalBar({ label, value, invert }: { label: string; value: number; invert?: boolean }) {
  const v = invert ? 1 - value : value;
  return (
    <div>
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-ink-2">{label}</span>
        <span className="tabular-nums text-muted">{Math.round(v * 100)}</span>
      </div>
      <div className="mt-1.5 h-px w-full bg-line">
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: v }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
          className="h-px origin-left bg-ink"
        />
      </div>
    </div>
  );
}

export default function PieceDetail({
  piece,
  onSelect,
  compact,
}: {
  piece: Piece;
  onSelect?: (slug: string) => void;
  compact?: boolean;
}) {
  const score = nicheScore(piece.signals);
  const similar = similarPieces(piece);
  const hero = piece.images[0];

  return (
    <article className={compact ? "" : "mx-auto max-w-6xl px-4 md:px-8"}>
      <div className={compact ? "" : "grid gap-10 md:grid-cols-[1.1fr_1fr] md:gap-16"}>
        <motion.div
          initial={{ opacity: 0, scale: 1.02 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          className={`relative w-full overflow-hidden bg-[#ebe8e2] ${compact ? "aspect-[4/5]" : "aspect-[3/4]"}`}
        >
          <Image
            src={img(hero.src, 1400, 80)}
            alt={hero.alt}
            fill
            priority
            sizes={compact ? "(max-width: 768px) 100vw, 40vw" : "(max-width: 768px) 100vw, 55vw"}
            className="object-cover"
          />
        </motion.div>

        <div className={compact ? "px-5 pb-28 pt-6 md:px-8" : "pt-2"}>
          <div className="flex items-start justify-between gap-6">
            <div>
              <p className="eyebrow">{piece.category}</p>
              <h1 className="font-serif mt-2 text-3xl leading-[1.05] tracking-tight md:text-4xl">
                {piece.brand}
              </h1>
              <p className="mt-1 text-base text-ink-2">{piece.name}</p>
              <p className="mt-3 text-lg tabular-nums">{piece.price}</p>
            </div>
            <div className="flex flex-col items-center gap-1">
              <NicheScore value={score} size={64} />
              <span className="eyebrow">Niche</span>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            {piece.styles.map((s) => (
              <Link
                key={s}
                href={`/styles/${s}`}
                className="rounded-full border hairline px-3 py-1 text-[12px] text-ink-2 transition-colors hover:border-ink hover:text-ink"
              >
                {STYLE_MAP[s].name}
              </Link>
            ))}
          </div>

          <div className="mt-8 border-t hairline pt-6">
            <p className="eyebrow">Why it&apos;s niche</p>
            <p className="mt-3 text-[15px] leading-relaxed text-ink">{piece.why}</p>
          </div>

          <div className="mt-6 border-t hairline pt-6">
            <p className="eyebrow">Trend context</p>
            <p className="mt-3 text-[14px] leading-relaxed text-ink-2">{piece.trendNote}</p>
            {piece.styles[0] && (
              <p className="mt-2 text-[12px] text-muted">
                {STYLE_MAP[piece.styles[0]].name} · {STYLE_MAP[piece.styles[0]].trend.direction} ·{" "}
                {STYLE_MAP[piece.styles[0]].trend.note}
              </p>
            )}
          </div>

          <div className="mt-6 grid grid-cols-2 gap-x-8 gap-y-5 border-t hairline pt-6">
            <SignalBar label="Recognition" value={piece.signals.recognition} />
            <SignalBar label="Under the radar" value={piece.signals.popularity} invert />
            <SignalBar label="Longevity" value={piece.signals.longevity} />
            <SignalBar label="Craft" value={piece.signals.craft} />
          </div>

          {(piece.madeIn || piece.materials) && (
            <dl className="mt-6 grid grid-cols-2 gap-4 border-t hairline pt-6 text-[13px]">
              {piece.madeIn && (
                <div>
                  <dt className="eyebrow">Made in</dt>
                  <dd className="mt-1">{piece.madeIn}</dd>
                </div>
              )}
              {piece.materials && (
                <div>
                  <dt className="eyebrow">Materials</dt>
                  <dd className="mt-1">{piece.materials}</dd>
                </div>
              )}
            </dl>
          )}

          {!compact && <ShopButton piece={piece} />}

          <div className="mt-10 border-t hairline pt-6">
            <p className="eyebrow">Similar pieces</p>
            <div className="mt-4 grid grid-cols-4 gap-2 md:gap-3">
              {similar.map((s) => {
                const inner = (
                  <>
                    <div className="relative aspect-[3/4] w-full overflow-hidden bg-[#ebe8e2]">
                      <Image
                        src={img(s.images[0].src, 400)}
                        alt={s.images[0].alt}
                        fill
                        sizes="12vw"
                        className="object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                    </div>
                    <p className="mt-1.5 truncate text-[11px]">{s.brand}</p>
                  </>
                );
                return onSelect ? (
                  <button key={s.slug} type="button" onClick={() => onSelect(s.slug)} className="group text-left">
                    {inner}
                  </button>
                ) : (
                  <Link key={s.slug} href={`/p/${s.slug}`} className="group">
                    {inner}
                  </Link>
                );
              })}
            </div>
          </div>

          <p className="mt-8 text-[11px] leading-relaxed text-muted">
            niche does not sell this piece. The link opens {piece.retailer.name}. Imagery is
            editorial placeholder photography until product feeds are connected.
          </p>
        </div>
      </div>
    </article>
  );
}

export function ShopButton({ piece, floating }: { piece: Piece; floating?: boolean }) {
  return (
    <a
      href={piece.retailer.url}
      target="_blank"
      rel="noopener sponsored"
      data-outbound={piece.slug}
      className={`group/btn flex w-full items-center justify-between bg-ink px-5 py-4 text-bg transition-colors hover:bg-ink-2 ${
        floating ? "" : "mt-8"
      }`}
    >
      <span className="text-[13px]">Shop at {piece.retailer.name}</span>
      <span className="text-[13px] transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover/btn:translate-x-1">
        ↗
      </span>
    </a>
  );
}
