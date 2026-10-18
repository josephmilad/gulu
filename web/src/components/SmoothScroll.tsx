"use client";

import Lenis from "lenis";
import { createContext, useContext, useEffect, useRef, type RefObject } from "react";

const LenisContext = createContext<RefObject<Lenis | null> | null>(null);

/** Returns a ref to the Lenis instance (null when reduced motion is on or before mount). */
export const useLenis = () => useContext(LenisContext);

export default function SmoothScroll({ children }: { children: React.ReactNode }) {
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const l = new Lenis({ lerp: 0.09, smoothWheel: true, anchors: true });
    lenisRef.current = l;
    let raf = 0;
    const loop = (t: number) => {
      l.raf(t);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      l.destroy();
      lenisRef.current = null;
    };
  }, []);

  return <LenisContext.Provider value={lenisRef}>{children}</LenisContext.Provider>;
}
