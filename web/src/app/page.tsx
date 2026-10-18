import { Suspense } from "react";
import Hero from "@/components/Hero";
import Marquee from "@/components/Marquee";
import Feed from "@/components/Feed";
import StyleStrip from "@/components/StyleStrip";
import Manifesto from "@/components/Manifesto";

export default function Home() {
  return (
    <>
      <Hero />
      <Marquee />
      <Suspense fallback={<div className="h-[60vh]" />}>
        <Feed />
      </Suspense>
      <StyleStrip />
      <Manifesto />
    </>
  );
}
