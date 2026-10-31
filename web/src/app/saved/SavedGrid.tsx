"use client";

import Link from "next/link";
import { RANKED_MAP } from "@/lib/catalog";
import { useSaved } from "@/lib/store";
import PieceCard from "@/components/PieceCard";
import { HeartIcon } from "@/components/Icons";

export default function SavedGrid() {
  const list = useSaved().map((s) => RANKED_MAP[s]).filter(Boolean);
  return (
    <div className="grid">
      {list.length ? (
        list.map((p, i) => <PieceCard key={p.slug} piece={p} index={i} />)
      ) : (
        <div className="empty saved-empty">
          <div className="bigheart"><HeartIcon /></div>
          <b>Nothing saved yet</b>
          <span>Tap the heart on any piece to keep it here.</span>
          <Link href="/" className="pill dark" style={{ marginTop: 6 }}>Start browsing</Link>
        </div>
      )}
    </div>
  );
}
