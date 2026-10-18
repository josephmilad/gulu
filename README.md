# niche

A scroll-first discovery feed for clothing, shoes and accessories with low hype and high regard.
AI surfaces pieces that people who know a category rate highly but that the algorithm has not
flattened into a trend yet. Every piece links out to the platform that sells it. We do not sell.

- `web/` — the Next.js site (App Router, Tailwind v4, Framer Motion, Lenis smooth scroll)
- `docs/PLAN.md` — launch plan, scoring model, AI pipeline and roadmap

## Run locally

```bash
cd web
npm install
npm run dev        # http://localhost:3000
npm run build      # production build
npm run lint
```

## Where things live

| Path | What |
|---|---|
| `web/src/data/pieces.ts` | Seed catalogue. Add a piece here and it appears in the feed, gets a page at `/p/<slug>`, and is scored automatically. |
| `web/src/data/styles.ts` | Style archetypes (Old Money, Gorpcore…), their definitions and weekly trend reading. |
| `web/src/lib/types.ts` | `Piece`, `Style`, `Signals` and the `nicheScore()` formula. |
| `web/src/components/Feed.tsx` | Masonry feed with style/category filters stored in the URL. |
| `web/src/components/PiecePanel.tsx` | Right-side panel on desktop, full-screen sheet on phone. Opens via `?p=<slug>`. |
| `web/src/components/PieceDetail.tsx` | Piece page content, shared by the panel and `/p/<slug>`. |

## Imagery

The preview uses editorial photography under the Unsplash licence as placeholders. Replace with
retailer or affiliate product imagery as feeds are connected (see `docs/PLAN.md` §5).
