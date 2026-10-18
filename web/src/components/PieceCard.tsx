"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import type { Piece } from "@/lib/types";
import { nicheScore } from "@/lib/types";
import { img } from "@/lib/url";
import { STYLE_MAP } from "@/data/styles";

const RATIOS = ["aspect-[3/4]", "aspect-[4/5]", "aspect-[2/3]", "aspect-[3/4]", "aspect-[5/6]"];

export default function PieceCard({
  piece,
  index,
  onOpen,
}: {
  piece: Piece;
  index: number;
  onOpen: (slug: string) => void;
}) {
  const image = piece.images[0];
  const ratio = RATIOS[index % RATIOS.length];
  return (
    <motion.article
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -8% 0px" }}
      transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: (index % 3) * 0.06 }}
      className="group"
    >
      <button
        type="button"
        onClick={() => onOpen(piece.slug)}
        className="block w-full cursor-pointer text-left"
        aria-label={`${piece.brand} ${piece.name}`}
      >
        <div className={`relative ${ratio} w-full overflow-hidden bg-[#ebe8e2]`}>
          <Image
            src={img(image.src, 900)}
            alt={image.alt}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1280px) 33vw, 25vw"
            className="object-cover transition-transform duration-[1200ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.04]"
          />
          <div className="absolute inset-0 bg-ink/0 transition-colors duration-700 group-hover:bg-ink/5" />
          <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-bg/85 px-2.5 py-1 text-[11px] backdrop-blur-md">
            <span className="h-1.5 w-1.5 rounded-full bg-ink" />
            {nicheScore(piece.signals)}
          </div>
        </div>
        <div className="mt-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium">{piece.brand}</p>
            <p className="truncate text-[13px] text-ink-2">{piece.name}</p>
            <p className="mt-1 text-[11px] text-muted">
              {piece.styles.map((s) => STYLE_MAP[s].name).join(" · ")}
            </p>
          </div>
          <p className="shrink-0 text-[13px] tabular-nums text-ink-2">{piece.price}</p>
        </div>
      </button>
    </motion.article>
  );
}
