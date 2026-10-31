# niche

A scroll-first discovery feed for clothing, shoes and accessories with low hype and high regard.
AI surfaces pieces that people who know a category rate highly but that the algorithm has not
flattened into a trend yet. Every piece links out to the platform that sells it. We do not sell.

- `web/` — the Next.js site (App Router, Tailwind v4)
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
| `web/src/data/pieces.ts` | The catalogue. Add a piece here and it appears in the feed, gets a page at `/p/<slug>`, and is ranked automatically. |
| `web/src/data/styles.ts` | Style archetypes (Old Money, Romantic…), their definitions and trend reading. |
| `web/src/lib/types.ts` | `Piece`, `Style`, `Signals` and the ranking formula. |
| `web/src/lib/catalog.ts` | Ranked pieces, sorting, filtering, banner slides and category photos. |
| `web/src/app/shop.css` | The design system: colours, shapes, cards, sheets, bottom nav and animations. |
| `web/src/components/ShopGrid.tsx` | The main grid with the sticky Sort and Filter bar and its bottom sheet. Filters live in the URL. |
| `web/src/components/DetailSheet.tsx` | The piece sheet. Opens via `?p=<slug>`, slides in from the right on desktop and up from the bottom on phones, and can be swiped down to close. |
| `web/src/lib/store.ts` | Saved pieces (kept in the browser only) and the toast messages. |

## Imagery

The preview uses editorial photography under the Unsplash licence as placeholders. Replace with
retailer or affiliate product imagery as feeds are connected (see `docs/PLAN.md` §5).
