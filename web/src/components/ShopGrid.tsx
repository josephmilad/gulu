"use client";

import { useCallback, useRef, useState } from "react";
import { RANKED, SORTS, STYLES, STYLE_MAP, applyFilters, readFilters, type Filters, type RankedPiece, type SortKey } from "@/lib/catalog";
import { CATEGORIES } from "@/data/styles";
import { useShop } from "@/lib/useShop";
import { useScrollLock, useSheetDrag } from "@/lib/useSheetDrag";
import PieceCard from "./PieceCard";
import { SlidersIcon, SortIcon, XIcon } from "./Icons";

export default function ShopGrid({ pieces = RANKED, lockedStyle }: { pieces?: RankedPiece[]; lockedStyle?: string }) {
  const { params, update } = useShop();
  const f = readFilters(params, lockedStyle);
  const list = applyFilters(pieces, f);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Filters>(f);

  const apply = (next: Filters) => {
    update(
      {
        style: lockedStyle ? null : next.styles.join(",") || null,
        category: next.cats.join(",") || null,
        sort: next.sort === "rec" ? null : next.sort,
        q: next.q || null,
        p: null,
      },
      { toGrid: true },
    );
  };
  const remove = (patch: Partial<Filters>) => apply({ ...f, ...patch });

  const filterCount = (lockedStyle ? 0 : f.styles.length) + f.cats.length;
  const chips: React.ReactNode[] = [];
  if (f.q) chips.push(<button key="q" type="button" className="achip" onClick={() => remove({ q: "" })}>&ldquo;{f.q}&rdquo;<XIcon /></button>);
  if (!lockedStyle)
    f.styles.forEach((s) =>
      chips.push(<button key={s} type="button" className="achip" onClick={() => remove({ styles: f.styles.filter((x) => x !== s) })}>{STYLE_MAP[s as keyof typeof STYLE_MAP]?.name ?? s}<XIcon /></button>),
    );
  f.cats.forEach((c) =>
    chips.push(<button key={c} type="button" className="achip" onClick={() => remove({ cats: f.cats.filter((x) => x !== c) })}>{c}<XIcon /></button>),
  );
  if (chips.length > 1)
    chips.push(<button key="all" type="button" className="achip clear" onClick={() => apply({ q: "", styles: lockedStyle ? f.styles : [], cats: [], sort: f.sort })}>Clear all</button>);

  const openSheet = () => {
    setDraft(f);
    setOpen(true);
  };

  return (
    <section id="all" style={{ marginTop: 20 }}>
      <div className="toolbar">
        <div className="wrap">
          <div className="row">
            <button type="button" className="tbtn" onClick={openSheet}><SortIcon /><span>{SORTS[f.sort]}</span></button>
            <button type="button" className="tbtn" onClick={openSheet}>
              <SlidersIcon />Filter{filterCount > 0 && <span className="n">{filterCount}</span>}
            </button>
            <span className="total">{list.length} piece{list.length === 1 ? "" : "s"}</span>
          </div>
          {chips.length > 0 && <div className="active-row">{chips}</div>}
        </div>
      </div>
      <div className="wrap">
        <div className="grid">
          {list.length ? (
            list.map((p, i) => <PieceCard key={p.slug} piece={p} index={i} />)
          ) : (
            <div className="empty"><b>No pieces match</b>Try removing a filter or searching for something else.</div>
          )}
        </div>
      </div>
      <FilterSheet
        open={open}
        draft={draft}
        setDraft={setDraft}
        lockedStyle={lockedStyle}
        count={applyFilters(pieces, draft).length}
        onClose={() => setOpen(false)}
        onApply={() => {
          setOpen(false);
          apply(draft);
        }}
      />
    </section>
  );
}

function FilterSheet({
  open, draft, setDraft, lockedStyle, count, onClose, onApply,
}: {
  open: boolean;
  draft: Filters;
  setDraft: (f: Filters) => void;
  lockedStyle?: string;
  count: number;
  onClose: () => void;
  onApply: () => void;
}) {
  const sheet = useRef<HTMLElement>(null);
  const scrim = useRef<HTMLDivElement>(null);
  const close = useCallback(() => onClose(), [onClose]);
  useSheetDrag(sheet, scrim, close, open);
  useScrollLock(open);
  const toggle = (key: "styles" | "cats", v: string) =>
    setDraft({ ...draft, [key]: draft[key].includes(v) ? draft[key].filter((x) => x !== v) : [...draft[key], v] });

  return (
    <>
      <div ref={scrim} className={`scrim${open ? " on" : ""}`} onClick={onClose} />
      <aside ref={sheet} className={`sheet center${open ? " on" : ""}`} role="dialog" aria-modal="true" aria-label="Sort and filter"
        onKeyDown={(e) => e.key === "Escape" && onClose()}>
        <div className="grab" data-drag />
        <div className="shead" data-drag>
          <h3>Sort and filter</h3>
          <button type="button" className="ibtn" aria-label="Close" onClick={onClose}><XIcon /></button>
        </div>
        <div className="sbody">
          <div className="fsec">
            <h4>Sort by</h4>
            <div className="radio">
              {(Object.keys(SORTS) as SortKey[]).map((k) => (
                <button key={k} type="button" className={draft.sort === k ? "on" : ""} onClick={() => setDraft({ ...draft, sort: k })}>
                  {SORTS[k]}<span className="dot" />
                </button>
              ))}
            </div>
          </div>
          {!lockedStyle && (
            <div className="fsec">
              <h4>Style</h4>
              <div className="chips">
                {STYLES.map((s) => (
                  <button key={s.slug} type="button" className={`chip${draft.styles.includes(s.slug) ? " on" : ""}`} onClick={() => toggle("styles", s.slug)}>{s.name}</button>
                ))}
              </div>
            </div>
          )}
          <div className="fsec">
            <h4>Category</h4>
            <div className="chips">
              {CATEGORIES.map((c) => (
                <button key={c} type="button" className={`chip${draft.cats.includes(c) ? " on" : ""}`} onClick={() => toggle("cats", c)}>{c}</button>
              ))}
            </div>
          </div>
        </div>
        <div className="sfoot">
          <button type="button" className="ghost" onClick={() => setDraft({ q: draft.q, styles: lockedStyle ? draft.styles : [], cats: [], sort: "rec" })}>Clear all</button>
          <button type="button" className="go" disabled={!count} onClick={onApply}>
            {count ? `Show ${count} piece${count === 1 ? "" : "s"}` : "No pieces match"}
          </button>
        </div>
      </aside>
    </>
  );
}
