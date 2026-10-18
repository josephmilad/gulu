export type Category =
  | "Outerwear"
  | "Tailoring"
  | "Tops"
  | "Knitwear"
  | "Bottoms"
  | "Dresses"
  | "Shoes"
  | "Bags"
  | "Eyewear"
  | "Watches"
  | "Hats";

export type StyleSlug =
  | "old-money"
  | "quiet-luxury"
  | "workwear"
  | "gorpcore"
  | "minimal"
  | "avant-garde"
  | "ivy"
  | "scandi"
  | "japanese";

export interface Style {
  slug: StyleSlug;
  name: string;
  tagline: string;
  definition: string;
  trend: { direction: "rising" | "steady" | "cooling"; note: string };
  cover: string;
}

export interface Signals {
  recognition: number; // 0-1 praised by people who know the category
  popularity: number; // 0-1 how mainstream it is (lower = more niche)
  longevity: number; // 0-1 relevance across seasons
  craft: number; // 0-1 materials, construction, origin
}

export interface Piece {
  slug: string;
  brand: string;
  name: string;
  category: Category;
  styles: StyleSlug[];
  price: string;
  currency?: string;
  retailer: { name: string; url: string };
  images: { src: string; alt: string; ratio: number }[];
  why: string;
  trendNote: string;
  signals: Signals;
  madeIn?: string;
  materials?: string;
  tags?: string[];
}

export function nicheScore(s: Signals): number {
  const v =
    0.35 * s.recognition +
    0.3 * (1 - s.popularity) +
    0.15 * s.longevity +
    0.2 * s.craft;
  return Math.round(v * 100);
}
