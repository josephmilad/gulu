import { PIECES } from "@/data/pieces";
import { STYLES, STYLE_MAP, CATEGORIES } from "@/data/styles";
import { nicheScore, type Piece, type Style } from "@/lib/types";

export type RankedPiece = Piece & { rank: number };

export const RANKED: RankedPiece[] = PIECES.map((p) => ({ ...p, rank: nicheScore(p.signals) }));
const RATIOS = ["2/3", "3/4", "4/5", "3/5", "3/4", "5/7", "4/5", "2/3", "3/4", "3/5"];
/** A stable photo shape per piece so the masonry grid has varied heights. */
export function ratioFor(slug: string): string {
  const i = RANKED.findIndex((p) => p.slug === slug);
  return RATIOS[(i < 0 ? 0 : i) % RATIOS.length];
}

export const RANKED_MAP: Record<string, RankedPiece> = Object.fromEntries(RANKED.map((p) => [p.slug, p]));

export const SORTS = {
  rec: "Recommended",
  rank: "Highest ranked",
  radar: "Most under the radar",
  craft: "Best craft",
} as const;
export type SortKey = keyof typeof SORTS;

export const DIRECTION_LABEL: Record<Style["trend"]["direction"], string> = {
  rising: "↗ Rising",
  steady: "→ Steady",
  cooling: "↘ Cooling",
};

export const CATEGORY_IMAGE: Record<string, string> = {
  Outerwear: "/img/1485462537746-965f33f7f6a7.jpg",
  Tailoring: "/img/1617137968427-85924c800a22.jpg",
  Tops: "/img/1541101767792-f9b2b1c4f127.jpg",
  Knitwear: "/img/1516826957135-700dedea698c.jpg",
  Bottoms: "/img/1594633312681-425c7b97ccd1.jpg",
  Dresses: "/img/1515372039744-b8f02a3ae446.jpg",
  Shoes: "/img/1549298916-b41d501d3772.jpg",
  Bags: "/img/1584917865442-de89df76afd3.jpg",
  Eyewear: "/img/1469334031218-e382a71b716b.jpg",
  Watches: "/img/1523170335258-f5ed11844a49.jpg",
  Hats: "/img/1539571696357-5a69c17a67c6.jpg",
};

export const USED_CATEGORIES = CATEGORIES.filter((c) => RANKED.some((p) => p.category === c));

export const SLIDES = [
  { style: "romantic", tag: "Rising", title: "Romantic", text: "Smocking, frills and full skirts are back, made slowly by small labels.", img: "/img/1581044777550-4cfa60707c03.jpg" },
  { style: "old-money", tag: "Cooling, still strong", title: "Old Money", text: "The hashtag faded. The heritage makers did not.", img: "/img/1539109136881-3be0616acf4b.jpg" },
  { style: "workwear", tag: "Rising", title: "Workwear", text: "Selvedge, horsehide and stitchdown boots that age better than you.", img: "/img/1520975661595-6453be3f7070.jpg" },
  { style: "japanese", tag: "Rising", title: "Japanese", text: "Recognition far ahead of popularity. Small runs, long waits.", img: "/img/1617137968427-85924c800a22.jpg" },
] as const;

export const TOP_RANKED = [...RANKED].sort((a, b) => b.rank - a.rank).slice(0, 10);
export const UNDER_RADAR = [...RANKED]
  .sort((a, b) => a.signals.popularity - b.signals.popularity || b.rank - a.rank)
  .slice(0, 10);

export interface Filters {
  q: string;
  styles: string[];
  cats: string[];
  sort: SortKey;
}

export function applyFilters(list: RankedPiece[], f: Filters): RankedPiece[] {
  const q = f.q.trim().toLowerCase();
  const out = list.filter(
    (p) =>
      (!f.styles.length || p.styles.some((s) => f.styles.includes(s))) &&
      (!f.cats.length || f.cats.includes(p.category)) &&
      (!q ||
        [p.brand, p.name, p.category, ...p.styles.map((s) => STYLE_MAP[s].name)]
          .join(" ")
          .toLowerCase()
          .includes(q)),
  );
  if (f.sort === "rank") out.sort((a, b) => b.rank - a.rank);
  if (f.sort === "radar") out.sort((a, b) => a.signals.popularity - b.signals.popularity);
  if (f.sort === "craft") out.sort((a, b) => b.signals.craft - a.signals.craft);
  return out;
}

export function readFilters(params: URLSearchParams, lockedStyle?: string): Filters {
  const list = (k: string) => (params.get(k) || "").split(",").filter(Boolean);
  const sort = params.get("sort");
  return {
    q: params.get("q") || "",
    styles: lockedStyle ? [lockedStyle] : list("style"),
    cats: list("category"),
    sort: sort && sort in SORTS ? (sort as SortKey) : "rec",
  };
}

export function similar(p: Piece, n = 8): RankedPiece[] {
  return RANKED.filter((x) => x.slug !== p.slug)
    .map((x) => ({ x, s: (x.category === p.category ? 2 : 0) + x.styles.filter((s) => p.styles.includes(s)).length }))
    .sort((a, b) => b.s - a.s)
    .slice(0, n)
    .map((o) => o.x);
}

export { STYLES, STYLE_MAP };
