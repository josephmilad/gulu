"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { ratioFor, type RankedPiece } from "@/lib/catalog";
import PieceCard from "./PieceCard";

const QUERIES = ["(min-width: 1500px)", "(min-width: 1100px)", "(min-width: 700px)"];

function columns(): number {
  if (window.matchMedia(QUERIES[0]).matches) return 5;
  if (window.matchMedia(QUERIES[1]).matches) return 4;
  if (window.matchMedia(QUERIES[2]).matches) return 3;
  return 2;
}

function subscribe(cb: () => void) {
  const mqs = QUERIES.map((q) => window.matchMedia(q));
  mqs.forEach((m) => m.addEventListener("change", cb));
  return () => mqs.forEach((m) => m.removeEventListener("change", cb));
}

/** Pinterest-style grid: each card goes into the currently shortest column. */
export default function Masonry({ pieces, empty }: { pieces: RankedPiece[]; empty: ReactNode }) {
  const n = useSyncExternalStore(subscribe, columns, () => 2);
  if (!pieces.length) return <div className="masonry">{empty}</div>;
  const cols: { piece: RankedPiece; i: number; ratio: string }[][] = Array.from({ length: n }, () => []);
  const heights = new Array(n).fill(0);
  pieces.forEach((piece, i) => {
    const ratio = ratioFor(piece.slug);
    const [w, h] = ratio.split("/").map(Number);
    const k = heights.indexOf(Math.min(...heights));
    cols[k].push({ piece, i, ratio });
    heights[k] += h / w + 0.25;
  });
  // remount on content change so the grid fades in
  const key = pieces.map((p) => p.slug).join("|");
  return (
    <div className="masonry fade" key={key}>
      {cols.map((col, ci) => (
        <div className="mcol" key={ci}>
          {col.map(({ piece, i, ratio }) => (
            <PieceCard key={piece.slug} piece={piece} index={i} ratio={ratio} />
          ))}
        </div>
      ))}
    </div>
  );
}
