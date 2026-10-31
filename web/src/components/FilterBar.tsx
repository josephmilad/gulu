"use client";

import { STYLES, CATEGORIES } from "@/data/styles";

type Props = {
  style: string | null;
  category: string | null;
  count: number;
  onStyle: (v: string | null) => void;
  onCategory: (v: string | null) => void;
};

function Chip({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full border px-3.5 py-1.5 text-[12px] transition-all duration-300 ${
        active
          ? "border-ink bg-ink text-bg"
          : "hairline bg-transparent text-ink-2 hover:border-ink/40 hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

export default function FilterBar({ style, category, count, onStyle, onCategory }: Props) {
  return (
    <div className="filter-bar sticky z-30 border-b hairline bg-bg/95 backdrop-blur-xl">
      <div className="mx-auto max-w-[1800px] px-4 md:px-8">
        <div className="no-scrollbar -mx-4 flex items-center gap-2 overflow-x-auto px-4 py-2.5 md:mx-0 md:px-0 md:py-3">
          <span className="eyebrow mr-1 hidden shrink-0 md:inline">Style</span>
          <Chip active={!style} onClick={() => onStyle(null)}>
            All
          </Chip>
          {STYLES.map((s) => (
            <Chip key={s.slug} active={style === s.slug} onClick={() => onStyle(style === s.slug ? null : s.slug)}>
              {s.name}
            </Chip>
          ))}
        </div>
        <div className="no-scrollbar -mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-2.5 md:mx-0 md:px-0 md:pb-3">
          <span className="eyebrow mr-1 hidden shrink-0 md:inline">Category</span>
          <Chip active={!category} onClick={() => onCategory(null)}>
            All
          </Chip>
          {CATEGORIES.map((c) => (
            <Chip key={c} active={category === c} onClick={() => onCategory(category === c ? null : c)}>
              {c}
            </Chip>
          ))}
          <span className="ml-auto hidden shrink-0 text-[11px] tabular-nums text-muted md:inline">
            {count} pieces
          </span>
        </div>
      </div>
    </div>
  );
}
