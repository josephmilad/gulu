"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RANKED_MAP, type RankedPiece } from "@/lib/catalog";
import { useShop } from "@/lib/useShop";
import { useScrollLock, useSheetDrag } from "@/lib/useSheetDrag";
import PieceDetail from "./PieceDetail";
import ShopActions from "./ShopActions";
import { XIcon } from "./Icons";

export default function DetailSheet() {
  const { params, update } = useShop();
  const slug = params.get("p");
  const piece = slug ? RANKED_MAP[slug] : undefined;
  const open = Boolean(piece);

  // keep the last piece rendered while the sheet animates closed
  const [shown, setShown] = useState<RankedPiece | undefined>(piece);
  if (piece && piece !== shown) setShown(piece);

  const sheet = useRef<HTMLElement>(null);
  const scrim = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const close = useCallback(() => update({ p: null }), [update]);
  useSheetDrag(sheet, scrim, close, open);
  useScrollLock(open);

  useEffect(() => {
    body.current?.scrollTo({ top: 0 });
  }, [slug]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  return (
    <>
      <div ref={scrim} className={`scrim${open ? " on" : ""}`} onClick={close} />
      <aside ref={sheet} className={`sheet dsheet${open ? " on" : ""}`} role="dialog" aria-modal="true" aria-label="Piece details" aria-hidden={!open}>
        <div className="grab" data-drag />
        <div className="sbody" ref={body}>
          <button type="button" className="close" aria-label="Close" onClick={close}><XIcon /></button>
          {shown && <PieceDetail key={shown.slug} piece={shown} onStyle={close} />}
        </div>
        <div className="sfoot">{shown && <ShopActions piece={shown} />}</div>
      </aside>
    </>
  );
}
