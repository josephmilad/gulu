"use client";

import { useEffect, useRef, useState } from "react";
import { SLIDES } from "@/lib/catalog";
import { useShop } from "@/lib/useShop";
import Media from "./Media";
import { ArrowUpRight } from "./Icons";

export default function HeroCarousel() {
  const { update } = useShop();
  const track = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const hold = useRef(false);

  const step = () => {
    const el = track.current;
    if (!el || el.children.length < 2) return el?.clientWidth ?? 1;
    return (el.children[1] as HTMLElement).offsetLeft - (el.children[0] as HTMLElement).offsetLeft;
  };
  const go = (i: number) => {
    const n = (i + SLIDES.length) % SLIDES.length;
    track.current?.scrollTo({ left: n * step(), behavior: "smooth" });
  };

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => {
      const el = track.current;
      if (!el || hold.current || document.hidden) return;
      const cur = Math.round(el.scrollLeft / step());
      const n = (cur + 1) % SLIDES.length;
      el.scrollTo({ left: n * step(), behavior: "smooth" });
    }, 5500);
    return () => clearInterval(id);
  }, []);

  return (
    <section className="hero" aria-label="Featured edits">
      <div
        className="slides"
        ref={track}
        onScroll={(e) => setActive(Math.round(e.currentTarget.scrollLeft / step()))}
        onPointerDown={() => (hold.current = true)}
        onPointerUp={() => (hold.current = false)}
        onPointerCancel={() => (hold.current = false)}
        onTouchStart={() => (hold.current = true)}
        onTouchEnd={() => (hold.current = false)}
      >
        {SLIDES.map((s, i) => (
          <button
            key={s.style}
            type="button"
            className={`slide${i === active ? " active" : ""}`}
            onClick={() => update({ style: s.style, category: null, p: null }, { toGrid: true })}
          >
            <Media src={s.img} alt={s.title} sizes="(max-width: 900px) 100vw, 50vw" priority={i < 2} />
            <div className="shade" />
            <div className="copy">
              <span className="tag">{s.tag}</span>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
              <span className="pill light" style={{ marginTop: 6 }}>
                Shop the edit <ArrowUpRight />
              </span>
            </div>
          </button>
        ))}
      </div>
      <div className="dots">
        {SLIDES.map((s, i) => (
          <button key={s.style} type="button" className={i === active ? "on" : ""} aria-label={`Show ${s.title}`} onClick={() => go(i)} />
        ))}
      </div>
    </section>
  );
}
