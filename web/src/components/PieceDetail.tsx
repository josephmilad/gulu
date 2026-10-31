"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { DIRECTION_LABEL, similar, type RankedPiece } from "@/lib/catalog";
import { STYLE_MAP } from "@/data/styles";
import Media from "./Media";
import PieceCard from "./PieceCard";

function Bar({ label, v }: { label: string; v: number }) {
  return (
    <div className="bar" style={{ "--v": v.toFixed(2) } as CSSProperties}>
      <div className="h"><span>{label}</span><b>{Math.round(v * 100)}</b></div>
      <div className="t"><div className="f" /></div>
    </div>
  );
}

export function Ring({ value }: { value: number }) {
  const r = 25;
  const c = 2 * Math.PI * r;
  return (
    <div className="rank-ring">
      <div className="r">
        <svg width="58" height="58">
          <circle className="bg" cx="29" cy="29" r={r} />
          <circle className="fg" cx="29" cy="29" r={r} strokeDasharray={c} strokeDashoffset={c - (value / 100) * c} />
        </svg>
        <span className="v">{value}</span>
      </div>
      <small>Niche ranking</small>
    </div>
  );
}

/** Piece content shared by the bottom sheet and the standalone piece page. */
export default function PieceDetail({ piece, onStyle }: { piece: RankedPiece; onStyle?: () => void }) {
  const st = STYLE_MAP[piece.styles[0]];
  const img = piece.images[0];
  return (
    <>
      <Media src={img.src} alt={img.alt} sizes="(max-width: 900px) 100vw, 520px" priority className="dhero" />
      <div className="dc">
        <div className="dtop">
          <div>
            <div className="cat">{piece.category}</div>
            <h2>{piece.brand}</h2>
            <p className="nm">{piece.name}</p>
            <p className="pr">{piece.price}</p>
          </div>
          <Ring value={piece.rank} />
        </div>
        <div className="dtags">
          {piece.styles.map((s) => (
            <Link key={s} href={`/?style=${s}#all`} className="chip" style={{ display: "inline-flex", alignItems: "center" }} onClick={onStyle}>
              {STYLE_MAP[s].name}
            </Link>
          ))}
        </div>
        <div className="box"><h4>Why it&apos;s special</h4><p>{piece.why}</p></div>
        <div className="box">
          <h4>Trend context</h4>
          <p className="sub">{piece.trendNote}</p>
          <div className="trendline"><span className="dir">{DIRECTION_LABEL[st.trend.direction]}</span>{st.name}</div>
        </div>
        <div className="bars">
          <Bar label="Recognition" v={piece.signals.recognition} />
          <Bar label="Under the radar" v={1 - piece.signals.popularity} />
          <Bar label="Longevity" v={piece.signals.longevity} />
          <Bar label="Craft" v={piece.signals.craft} />
        </div>
        {(piece.madeIn || piece.materials) && (
          <div className="facts">
            {piece.madeIn && <div><small>Made in</small><span>{piece.madeIn}</span></div>}
            {piece.materials && <div><small>Materials</small><span>{piece.materials}</span></div>}
          </div>
        )}
        <div>
          <div className="head" style={{ marginBottom: 10 }}><div><h2 style={{ fontSize: 17 }}>You may also like</h2></div></div>
          <div className="rail" style={{ marginLeft: "calc(-1 * var(--gl))", marginRight: "calc(-1 * var(--gr))" }}>
            {similar(piece).map((p, i) => <PieceCard key={p.slug} piece={p} index={i} />)}
          </div>
        </div>
        <p className="note">
          We don&apos;t sell this piece. The button opens {piece.retailer.name}. Photos are placeholders until product feeds are connected.
        </p>
      </div>
    </>
  );
}
