"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { PIECES } from "@/data/pieces";
import type { Piece } from "@/lib/types";
import PieceCard from "./PieceCard";
import FilterBar from "./FilterBar";

function useColumns() {
  const [cols, setCols] = useState(4);
  useEffect(() => {
    const mq = [
      window.matchMedia("(min-width: 1280px)"),
      window.matchMedia("(min-width: 768px)"),
    ];
    const update = () => setCols(mq[0].matches ? 4 : mq[1].matches ? 3 : 2);
    update();
    mq.forEach((m) => m.addEventListener("change", update));
    return () => mq.forEach((m) => m.removeEventListener("change", update));
  }, []);
  return cols;
}

export default function Feed({
  pieces = PIECES,
  lockedStyle,
}: {
  pieces?: Piece[];
  lockedStyle?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const style = lockedStyle ?? params.get("style");
  const category = params.get("category");
  const cols = useColumns();

  const setParam = useCallback(
    (key: string, value: string | null) => {
      const next = new URLSearchParams(params.toString());
      if (value) next.set(key, value);
      else next.delete(key);
      next.delete("p");
      router.replace(`${pathname}${next.toString() ? `?${next}` : ""}`, { scroll: false });
    },
    [params, pathname, router],
  );

  const open = useCallback(
    (slug: string) => {
      const next = new URLSearchParams(params.toString());
      next.set("p", slug);
      router.push(`${pathname}?${next}`, { scroll: false });
    },
    [params, pathname, router],
  );

  const filtered = useMemo(
    () =>
      pieces.filter(
        (p) => (!style || p.styles.includes(style as never)) && (!category || p.category === category),
      ),
    [pieces, style, category],
  );

  const columns = useMemo(() => {
    const out: { piece: Piece; index: number }[][] = Array.from({ length: cols }, () => []);
    filtered.forEach((piece, index) => out[index % cols].push({ piece, index }));
    return out;
  }, [filtered, cols]);

  return (
    <section id="feed">
      <FilterBar
        style={lockedStyle ? null : style}
        category={category}
        count={filtered.length}
        onStyle={(v) => setParam("style", v)}
        onCategory={(v) => setParam("category", v)}
      />
      <div className="mx-auto max-w-[1800px] px-4 py-6 md:px-8 md:py-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={`${style}-${category}-${cols}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
            className="grid gap-x-3 gap-y-8 md:gap-x-5 md:gap-y-12"
            style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
          >
            {columns.map((col, ci) => (
              <div
                key={ci}
                className={`flex flex-col gap-8 md:gap-12 ${ci % 2 === 1 ? "md:mt-16" : ""}`}
              >
                {col.map(({ piece, index }) => (
                  <PieceCard key={piece.slug} piece={piece} index={index} onOpen={open} />
                ))}
              </div>
            ))}
          </motion.div>
        </AnimatePresence>
        {filtered.length === 0 && (
          <p className="py-24 text-center text-sm text-muted">
            Nothing here yet. Try another style or category.
          </p>
        )}
      </div>
    </section>
  );
}
