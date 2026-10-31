"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RANKED, SORTS, STYLES, STYLE_MAP, applyFilters, readFilters, type Filters, type RankedPiece, type SortKey } from "@/lib/catalog";
import { CATEGORIES } from "@/data/styles";
import { scrollToGrid, useShop } from "@/lib/useShop";
import { useScrollLock, useSheetDrag } from "@/lib/useSheetDrag";
import Masonry from "./Masonry";
import { SlidersIcon, SortIcon, XIcon } from "./Icons";

const Chevron = () => (
  <svg className="icon chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
);

export default function ShopGrid({ pieces = RANKED, lockedStyle }: { pieces?: RankedPiece[]; lockedStyle?: string }) {
  const { params, update } = useShop();
  const f = readFilters(params, lockedStyle);
  const list = applyFilters(pieces, f);
  const [panelOpen, setPanelOpen] = useState(true);
  const [sortOpen, setSortOpen] = useState(false);
  const openedAt = useRef(0);
  const section = useRef<HTMLElement>(null);

  // fold the filter rows away once the visitor scrolls down into the grid
  useEffect(() => {
    if (!panelOpen) return;
    openedAt.current = window.scrollY;
    const onScroll = () => {
      const el = section.current;
      if (!el) return;
      const gridTop = el.getBoundingClientRect().top + window.scrollY;
      if (window.scrollY > gridTop + 240 && window.scrollY - openedAt.current > 140) setPanelOpen(false);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [panelOpen]);

  const apply = (next: Filters, toGrid = false) =>
    update(
      {
        style: lockedStyle ? null : next.styles.join(",") || null,
        category: next.cats.join(",") || null,
        sort: next.sort === "rec" ? null : next.sort,
        q: next.q || null,
        p: null,
      },
      { toGrid },
    );
  const toggle = (key: "styles" | "cats", v: string) => {
    apply({ ...f, [key]: f[key].includes(v) ? f[key].filter((x) => x !== v) : [...f[key], v] });
    if ((section.current?.getBoundingClientRect().top ?? 0) < -4) setTimeout(scrollToGrid, 80);
  };

  const filterCount = (lockedStyle ? 0 : f.styles.length) + f.cats.length;
  const chips: React.ReactNode[] = [];
  if (f.q) chips.push(<button key="q" type="button" className="achip" onClick={() => apply({ ...f, q: "" })}>&ldquo;{f.q}&rdquo;<XIcon /></button>);
  if (!panelOpen) {
    if (!lockedStyle)
      f.styles.forEach((s) =>
        chips.push(<button key={s} type="button" className="achip" onClick={() => toggle("styles", s)}>{STYLE_MAP[s as keyof typeof STYLE_MAP]?.name ?? s}<XIcon /></button>),
      );
    f.cats.forEach((c) => chips.push(<button key={c} type="button" className="achip" onClick={() => toggle("cats", c)}>{c}<XIcon /></button>));
    if (chips.length > 1)
      chips.push(<button key="all" type="button" className="achip clear" onClick={() => apply({ q: "", styles: lockedStyle ? f.styles : [], cats: [], sort: f.sort })}>Clear all</button>);
  }

  return (
    <section id="all" ref={section} style={{ marginTop: 20 }}>
      <div className="toolbar">
        <div className="wrap">
          <div className="row">
            <button type="button" className="tbtn" onClick={() => setSortOpen(true)}><SortIcon /><span>{SORTS[f.sort]}</span></button>
            <button
              type="button"
              className={`tbtn${panelOpen ? " open" : ""}`}
              aria-expanded={panelOpen}
              aria-controls="fpanel"
              onClick={() => setPanelOpen((o) => !o)}
            >
              <SlidersIcon />Filter{filterCount > 0 && <span className="n">{filterCount}</span>}<Chevron />
            </button>
            <span className="total">{list.length} piece{list.length === 1 ? "" : "s"}</span>
          </div>
          <div className={`fpanel${panelOpen ? " open" : ""}`} id="fpanel">
            <div>
              {!lockedStyle && (
                <div className="frow">
                  <span className="lbl">Style</span>
                  {STYLES.map((s) => (
                    <button key={s.slug} type="button" className={`chip${f.styles.includes(s.slug) ? " on" : ""}`} onClick={() => toggle("styles", s.slug)}>{s.name}</button>
                  ))}
                </div>
              )}
              <div className="frow">
                <span className="lbl">Category</span>
                {CATEGORIES.map((c) => (
                  <button key={c} type="button" className={`chip${f.cats.includes(c) ? " on" : ""}`} onClick={() => toggle("cats", c)}>{c}</button>
                ))}
                {filterCount > 0 && (
                  <button type="button" className="fclear" onClick={() => apply({ ...f, styles: lockedStyle ? f.styles : [], cats: [] })}>Clear</button>
                )}
              </div>
            </div>
          </div>
          {chips.length > 0 && <div className="active-row">{chips}</div>}
        </div>
      </div>
      <div className="tight">
        <Masonry pieces={list} empty={<div className="empty"><b>No pieces match</b>Try removing a filter or searching for something else.</div>} />
      </div>
      <SortSheet
        open={sortOpen}
        value={f.sort}
        onClose={() => setSortOpen(false)}
        onPick={(k) => {
          setSortOpen(false);
          apply({ ...f, sort: k });
          setTimeout(scrollToGrid, 240);
        }}
      />
    </section>
  );
}

function SortSheet({ open, value, onClose, onPick }: { open: boolean; value: SortKey; onClose: () => void; onPick: (k: SortKey) => void }) {
  const sheet = useRef<HTMLElement>(null);
  const scrim = useRef<HTMLDivElement>(null);
  const close = useCallback(() => onClose(), [onClose]);
  useSheetDrag(sheet, scrim, close, open);
  useScrollLock(open);
  return (
    <>
      <div ref={scrim} className={`scrim${open ? " on" : ""}`} onClick={onClose} />
      <aside ref={sheet} className={`sheet center${open ? " on" : ""}`} role="dialog" aria-modal="true" aria-label="Sort by"
        onKeyDown={(e) => e.key === "Escape" && onClose()}>
        <div className="grab" data-drag />
        <div className="shead" data-drag>
          <h3>Sort by</h3>
          <button type="button" className="ibtn" aria-label="Close" onClick={onClose}><XIcon /></button>
        </div>
        <div className="sbody">
          <div className="fsec" style={{ paddingBottom: "calc(18px + env(safe-area-inset-bottom, 0px))" }}>
            <div className="radio">
              {(Object.keys(SORTS) as SortKey[]).map((k) => (
                <button key={k} type="button" className={value === k ? "on" : ""} onClick={() => onPick(k)}>
                  {SORTS[k]}<span className="dot" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
