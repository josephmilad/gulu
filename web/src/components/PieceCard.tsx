"use client";

import type { CSSProperties } from "react";
import type { RankedPiece } from "@/lib/catalog";
import { STYLE_MAP } from "@/data/styles";
import { toggleSaved, useSaved } from "@/lib/store";
import { useShop } from "@/lib/useShop";
import Media from "./Media";
import { HeartIcon } from "./Icons";

/** Product card. With `ratio` it renders the compact masonry variant with a custom photo shape. */
export default function PieceCard({ piece, index = 0, ratio }: { piece: RankedPiece; index?: number; ratio?: string }) {
  const { openPiece } = useShop();
  const saved = useSaved().includes(piece.slug);
  const img = piece.images[0];
  const style = { "--i": index % 8, ...(ratio ? { "--ar": ratio } : {}) } as CSSProperties;
  return (
    <article className="card" style={style}>
      <button type="button" className="open" onClick={() => openPiece(piece.slug)} aria-label={`${piece.brand} ${piece.name}`}>
        <div style={{ position: "relative" }}>
          <Media src={img.src} alt={img.alt} sizes="(max-width: 700px) 50vw, (max-width: 1100px) 33vw, 25vw" priority={index < 4} />
          <span className="rank" title="Niche ranking">
            <i style={{ "--v": piece.rank } as CSSProperties} />
            {piece.rank}
          </span>
        </div>
        {ratio ? (
          <div className="info">
            <div className="l1">
              <span className="b">{piece.brand}</span>
              <span className="p">{piece.price}</span>
            </div>
            <span className="n">{piece.name}</span>
          </div>
        ) : (
          <div className="info">
            <span className="b">{piece.brand}</span>
            <span className="n">{piece.name}</span>
            <span className="p">{piece.price}</span>
            <span className="s">{piece.styles.map((s) => STYLE_MAP[s].name).join(" · ")}</span>
          </div>
        )}
      </button>
      <button
        type="button"
        className={`heart${saved ? " on" : ""}`}
        aria-pressed={saved}
        aria-label={`Save ${piece.brand}`}
        onClick={() => toggleSaved(piece.slug)}
      >
        <HeartIcon />
      </button>
    </article>
  );
}
