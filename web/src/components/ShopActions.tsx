"use client";

import type { RankedPiece } from "@/lib/catalog";
import { toggleSaved, useSaved } from "@/lib/store";
import { ArrowUpRight, HeartIcon } from "./Icons";

export default function ShopActions({ piece }: { piece: RankedPiece }) {
  const saved = useSaved().includes(piece.slug);
  return (
    <>
      <button type="button" className={`save${saved ? " on" : ""}`} aria-pressed={saved} aria-label="Save" onClick={() => toggleSaved(piece.slug)}>
        <HeartIcon />
      </button>
      <a className="shop" href={piece.retailer.url} target="_blank" rel="noopener sponsored">
        Shop at {piece.retailer.name} <ArrowUpRight />
      </a>
    </>
  );
}
