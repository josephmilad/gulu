# niche — Launch Plan

A scroll-first discovery site for niche, authentic clothing, shoes and accessories.
AI finds pieces that are **under-the-radar but highly rated**, scores them against current
trends and style archetypes (old money, gorpcore, quiet luxury, workwear, etc.), and shows
them on models in a feed. Tapping a piece opens its page (side panel on desktop, full screen
on mobile) and links out to the shop that sells it. We do not sell anything ourselves.

---

## 1. Product definition

### What we are
- A curated **feed of looks and pieces**, not a marketplace.
- Every item is **a redirect** to the platform that sells it (SSENSE, END., Mr Porter, brand
  sites, Grailed, Vinted, Etsy, small-label Shopify stores…).
- The value is **selection + context**: why this piece counts as niche, which style it belongs
  to, how it relates to the current trend cycle.

### What we are not (for v1)
- No checkout, no cart, no accounts, no user uploads.
- No price tracking or stock sync in v1 (just a "last checked" date).
- No native app. Mobile web first, wrap in a native shell later if traction appears.

### Core user flow
1. Land on the feed. Full-bleed photos of pieces on models, infinite scroll.
2. Optional filter bar across the top: **style** (Old Money, Quiet Luxury, Gorpcore,
   Workwear, Minimal, Avant-garde, Ivy/Prep, Western, Scandi…) and **category**
   (Tops, Bottoms, Outerwear, Shoes, Bags, Jewelry, Eyewear, Hats…).
3. Tap a photo → **piece page**:
   - Desktop: slides in as a right-side panel (~40% width); feed stays visible and scrollable.
   - Mobile: opens full screen with a back/close gesture.
   - Contents: hero image(s), brand, name, price range, our **Niche Score** and the reasoning
     behind it, style tags, "Why it's authentic" blurb, similar pieces, and a prominent
     **"Shop at {retailer}"** button that opens the external page in a new tab.
4. Close panel → back to exactly where you were in the feed.

---

## 2. The "niche but recognised" scoring model

This is the heart of the product and what makes it defensible. Define it explicitly so the
AI pipeline is reproducible.

### Signals per piece (0–1 normalised)

| Signal | Meaning | Sources |
|---|---|---|
| **Recognition** | Praised by people who know the category | Review scores & review count on retailer, Reddit (r/malefashionadvice, r/femalefashionadvice, r/goodyearwelt, r/rawdenim…), Substack/YouTube menswear & womenswear critics, StyleForum, Grailed demand |
| **Popularity (inverse)** | How mainstream it is; lower = more niche | Google Trends volume, Instagram/TikTok hashtag counts, brand follower count, presence on fast-fashion dupe lists |
| **Longevity** | Has stayed relevant across seasons | Years in production, archive resale value retention, repeated mentions over time |
| **Craft** | Material, construction, origin | Made-in, materials list, construction keywords (Goodyear welt, selvedge, full-grain, hand-finished) |
| **Trend relation** | Fits or contrasts a current trend in an interesting way | Our weekly trend index (see §4) |

### Niche Score
`niche = 0.35·recognition + 0.30·(1 − popularity) + 0.15·longevity + 0.20·craft`

A piece enters the feed if `niche ≥ 0.6` **and** recognition ≥ 0.5 (so we never show
obscure-but-bad things). Thresholds are tuned by hand during the seeding phase.

### Style classification
A multi-label classifier (LLM with a fixed rubric per style) assigns each piece 1–3 style
archetypes with confidence. Each archetype gets a written definition we control, e.g.
*Old Money: understated natural fibres, heritage brands, no visible logos, muted palette,
tailoring over streetwear.*

---

## 3. Phased roadmap

### Phase 0 — Validate (1–2 weeks, no code)
- Pick **3 style archetypes** to launch with (recommend: Old Money, Quiet Luxury, Gorpcore —
  high search interest, very different aesthetics, clear "niche" sub-brands in each).
- Hand-curate **60–100 pieces** (20–30 per style) in a spreadsheet: brand, name, category,
  retailer URL, image URL(s), price, style tags, one-line "why it's niche".
- Decide the brand name/domain and a visual direction (I suggest editorial, lots of white,
  one serif, one sans).
- Write the style archetype definitions (they become the AI rubric later).

### Phase 1 — Static site MVP (2–3 weeks)
Goal: a live URL people can scroll on their phone.

- **Stack**: Next.js (App Router) + Tailwind, deployed on Vercel. Content from a JSON/MDX
  file or a lightweight headless CMS (Sanity or Payload) so non-devs can add pieces.
- **Pages**: `/` feed, `/p/[slug]` piece page (rendered as panel on desktop via parallel
  routes/intercepting routes; full page on mobile and on direct link), `/s/[style]` style
  landing pages (good for SEO).
- **Feed**: masonry/column grid, lazy-loaded images, prefetch piece data on hover/near
  viewport, filter chips for style and category stored in URL params.
- **Piece panel**: desktop right-side drawer (URL updates so links are shareable), mobile
  full-screen sheet. "Shop" button is an outbound link with `rel="sponsored noopener"`.
- **Images**: use retailer/brand product imagery on models *with attribution and a link*,
  or generate our own model shots (see §5). Do not hot-link; cache through Next Image /
  a CDN with proper licensing notes per piece.
- **Analytics**: Plausible or PostHog. Track: scroll depth, piece opens, outbound clicks,
  filter usage. The ratio *outbound clicks / piece opens* is the KPI.
- **SEO basics**: OG images per piece, sitemap, structured data (Product schema with
  `offers.url` pointing outbound).

### Phase 2 — AI curation pipeline (3–5 weeks, parallel with Phase 1 polish)
Replace the hand spreadsheet with a semi-automated pipeline. Humans still approve.

1. **Candidate discovery**: scrape/ingest product listings from a whitelist of retailers
   and brand sites (respect robots.txt and ToS; prefer official affiliate/product feeds
   where available — Awin, Rakuten, CJ, Impact, Skimlinks all expose product catalogues).
2. **Enrichment**: for each candidate, gather the signals in §2 (review stats, Reddit/
   forum mentions via search APIs, Google Trends via `pytrends`, hashtag counts).
3. **Scoring + classification**: compute Niche Score; LLM (Claude) assigns style tags and
   writes the "why it's authentic" blurb from the evidence, citing sources.
4. **Review queue**: an internal admin page where you approve/reject/edit, then publish.
5. **Scheduling**: nightly job (Vercel Cron / GitHub Actions / a small worker) re-checks
   price, availability and dead links; unpublish on 404.

Data model (Postgres via Supabase or Neon, Prisma/Drizzle ORM):
`Piece`, `Brand`, `Retailer`, `Image`, `Style`, `PieceStyle(confidence)`, `Signal(snapshot,
source, value, fetched_at)`, `TrendSnapshot`.

### Phase 3 — Trend layer (ongoing)
- Weekly **trend index**: for each style archetype and ~50 trend keywords, pull Google
  Trends, TikTok/IG volumes, and runway/press mentions; store as a time series.
- Surface it in the UI: a small "Trend context" block on each piece
  (*"Quiet luxury search interest is down 20% YoY — this piece predates the trend and will
  outlast it"*) and a `/trends` page.
- Use it to rotate the feed: pieces that **contrast** an over-saturated trend get a boost.

### Phase 4 — Growth & monetisation experiments (after launch)
Decide later, but design for these now:
- **Affiliate links** — easiest; join networks in Phase 2 so outbound links are tagged
  from day one (invisible to users, no UX change).
- **Email digest** — weekly "5 pieces" newsletter; capture emails from Phase 1.
- Later options: paid "early access" to drops, brand-sponsored (clearly labelled)
  placements, a Pro tier with price alerts and saved boards.

---

## 4. AI responsibilities (concrete)

| Task | Approach |
|---|---|
| Discover candidates | Retailer feeds + targeted search queries per style ("Goodyear welted loafers under 500", "Japanese selvedge brands") |
| Gather evidence | Tool-using agent that queries Reddit/forum search, review APIs, Trends; stores raw snippets with URLs |
| Score | Deterministic formula over normalised signals; LLM only fills gaps (e.g. craft score from product description) |
| Classify style | LLM with fixed rubric, outputs JSON `{style, confidence, evidence[]}` |
| Write copy | LLM writes 2–3 sentence blurb grounded in stored evidence; must cite at least one source |
| Image handling | Classify images (on-model vs flat lay), pick hero, generate alt text; optionally generate on-model imagery (§5) |
| QA | Second LLM pass checks blurb against evidence for unsupported claims |

Everything AI-written is **drafted, not published** until a human approves in Phase 2;
once precision is >90% on review, auto-publish with spot checks.

---

## 5. Imagery strategy (biggest practical risk)

Options, in order of preference:
1. **Affiliate/brand-supplied imagery** — networks and most brands permit use when linking
   to purchase. Cleanest legally. Store licence note per image.
2. **Own editorial shots** — commission 1 shoot per style archetype at launch (~10 looks
   each). Expensive but defines the brand.
3. **AI-generated on-model imagery** — generate consistent "house models" wearing the real
   piece from the product flat image (virtual try-on models, e.g. via Higgsfield or
   similar). Always label as AI-rendered. Good for filling gaps, risky as the sole source.

Do **not** scrape Instagram/Pinterest editorial photos.

---

## 6. Launch checklist (Phase 1 exit criteria)
- [ ] Domain + brand name decided; logo and type set
- [ ] 3 styles × ≥20 approved pieces live, each with ≥1 on-model image and a working outbound link
- [ ] Feed scroll + panel/full-screen piece page working on iOS Safari, Android Chrome, desktop
- [ ] Lighthouse mobile performance ≥ 85
- [ ] Analytics + outbound click tracking firing
- [ ] Email capture on feed footer and piece page
- [ ] Privacy page, affiliate disclosure page, image attribution page
- [ ] Soft launch to 3–5 fashion subreddits / Substack writers for feedback

---

## 7. Suggested repo layout
```
gulu/
  apps/web/          Next.js site
  packages/schema/   shared types (Piece, Style, Signal…)
  packages/curation/ AI pipeline: discover → enrich → score → draft
  data/seed/         Phase 0 spreadsheet export (pieces.json, styles.json)
  docs/              this plan, style rubrics, image licensing notes
```

## 8. Immediate next steps
1. Confirm the 3 launch styles and the working name.
2. I scaffold `apps/web` with the feed + side-panel piece page using placeholder data.
3. You start the Phase 0 spreadsheet; I write the style rubric docs in `docs/styles/`.

---

## 9. Status (October 2026)

Phase 1 site is built in `web/`: hero, marquee, filterable masonry feed, side-panel / full-screen
piece pages, style landing pages, about and footer with email capture. Imagery is placeholder
editorial photography. Next: connect product feeds and the AI curation pipeline (Phase 2).

### Connectors needed for Phase 2
| Need | Service | Why |
|---|---|---|
| LLM for classification, blurbs, QA | Anthropic API key (Claude) | Style tagging, "why it's niche" copy, evidence checking |
| Product catalogues + affiliate links | Awin, Rakuten Advertising, CJ, or Skimlinks account | Real product data, images with licence to use, tracked outbound links |
| Evidence gathering | Reddit API, a web search API (Tavily / SerpAPI / Brave) | Recognition signal from forums, reviews, critics |
| Trend index | Google Trends (no key, via pytrends), optional TikTok Research API | Popularity and trend-direction signals |
| On-model imagery (optional) | Higgsfield (connector already attached) | Generate consistent house-model shots from flat product images, labelled as AI |
| Analytics | Plausible or PostHog | Scroll depth, piece opens, outbound click-through |
| Hosting | Vercel | Deploy `web/`, cron for nightly link/price checks |
| Email | Resend or Buttondown | Weekly digest from the footer sign-up |
| Database (Phase 2) | Supabase or Neon Postgres | Pieces, signals, trend snapshots, review queue |
