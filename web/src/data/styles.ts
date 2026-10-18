import type { Style } from "@/lib/types";

const u = (id: string) => `https://images.unsplash.com/photo-${id}`;

export const STYLES: Style[] = [
  {
    slug: "old-money",
    name: "Old Money",
    tagline: "Inherited, not bought.",
    definition:
      "Understated natural fibres, heritage makers, no visible logos, a muted palette and tailoring over streetwear. Pieces that look better after ten years than on day one.",
    trend: {
      direction: "cooling",
      note: "Search interest peaked in 2023 and is settling. The aesthetic is outlasting the hashtag.",
    },
    cover: u("1552374196-1ab2a1c593e8"),
  },
  {
    slug: "quiet-luxury",
    name: "Quiet Luxury",
    tagline: "If you know, you know.",
    definition:
      "Fabric-first design, impeccable finishing and silhouettes that say nothing loudly. Cashmere, silk, fine wool, soft leathers.",
    trend: {
      direction: "steady",
      note: "The term is saturated but the brands that defined it keep selling out. Expect a shift from beige to colour.",
    },
    cover: u("1434389677669-e08b4cac3105"),
  },
  {
    slug: "workwear",
    name: "Workwear",
    tagline: "Built to be worn out.",
    definition:
      "Garments descended from labour: selvedge denim, duck canvas, chore coats, welted boots. Judged on construction and how they age.",
    trend: {
      direction: "rising",
      note: "Japanese and American heritage makers are gaining ground as fast-fashion imitations date quickly.",
    },
    cover: u("1543076447-215ad9ba6923"),
  },
  {
    slug: "gorpcore",
    name: "Gorpcore",
    tagline: "Technical, off the trail.",
    definition:
      "Hiking and alpine gear worn in the city. Shells, fleece, trail runners. Valued for real performance specs, not the look of them.",
    trend: {
      direction: "cooling",
      note: "The mainstream wave is receding, which is pushing attention back to the engineering-led labels.",
    },
    cover: u("1521341957697-b93449760f30"),
  },
  {
    slug: "minimal",
    name: "Minimal",
    tagline: "Nothing to remove.",
    definition:
      "Reduced forms, considered proportions, restrained colour. The design is in the pattern cutting, not the details.",
    trend: {
      direction: "steady",
      note: "A permanent undercurrent. Rarely trends, never leaves.",
    },
    cover: u("1583743814966-8936f5b7be1a"),
  },
  {
    slug: "avant-garde",
    name: "Avant-garde",
    tagline: "Shape before season.",
    definition:
      "Sculptural volume, unexpected drape, experimental fabric. Pieces collected rather than consumed.",
    trend: {
      direction: "rising",
      note: "Archive resale prices for conceptual designers are climbing as mainstream fashion plays it safe.",
    },
    cover: u("1554412933-514a83d2f3c8"),
  },
  {
    slug: "ivy",
    name: "Ivy & Prep",
    tagline: "Campus, then the world.",
    definition:
      "Oxford cloth, loafers, Shetland knits, sack jackets. American collegiate dress as refined by Japan over fifty years.",
    trend: {
      direction: "rising",
      note: "A quieter, more academic cousin of Old Money that is picking up its momentum.",
    },
    cover: u("1594938298603-c8148c4dae35"),
  },
  {
    slug: "scandi",
    name: "Scandi",
    tagline: "Soft structure.",
    definition:
      "Clean lines, functional layers and a palette lifted from the Nordic winter. Design-led, never fussy.",
    trend: {
      direction: "steady",
      note: "Copenhagen's influence is stable. The labels to watch are the smaller ones around the big names.",
    },
    cover: u("1584917865442-de89df76afd3"),
  },
  {
    slug: "japanese",
    name: "Japanese",
    tagline: "Obsession as craft.",
    definition:
      "Reproduction and reinterpretation taken to the extreme: loomed denim, hand-dyed indigo, perfected basics. Small runs, long waits.",
    trend: {
      direction: "rising",
      note: "Still under-indexed outside the enthusiast community. Recognition far exceeds popularity.",
    },
    cover: u("1591047139829-d91aecb6caea"),
  },
];

export const STYLE_MAP = Object.fromEntries(STYLES.map((s) => [s.slug, s])) as Record<
  Style["slug"],
  Style
>;

export const CATEGORIES = [
  "Outerwear",
  "Tailoring",
  "Tops",
  "Knitwear",
  "Bottoms",
  "Dresses",
  "Shoes",
  "Bags",
  "Eyewear",
  "Watches",
  "Hats",
] as const;
