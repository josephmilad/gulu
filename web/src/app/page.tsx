import { Suspense } from "react";
import HeroCarousel from "@/components/HeroCarousel";
import { CategoryBubbles, HowItWorks, Rail, StyleTiles } from "@/components/HomeSections";
import ShopGrid from "@/components/ShopGrid";
import { TOP_RANKED, UNDER_RADAR } from "@/lib/catalog";

export default function Home() {
  return (
    <Suspense fallback={<div style={{ minHeight: "80vh" }} />}>
      <HeroCarousel />
      <CategoryBubbles />
      <Rail title="Top ranked right now" sub="Highest niche ranking across every style" pieces={TOP_RANKED} sort="rank" />
      <StyleTiles />
      <Rail title="Under the radar" sub="Loved by people who know, rarely seen elsewhere" pieces={UNDER_RADAR} sort="radar" />
      <ShopGrid />
      <HowItWorks />
    </Suspense>
  );
}
