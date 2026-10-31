"use client";

/** Eased scrolling: a gentle start and soft landing that stops as soon as the visitor touches the page. */
let raf = 0;
let finish: (() => void) | null = null;

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function smoothScrollTo(target: number): Promise<void> {
  return new Promise((resolve) => {
    cancelAnimationFrame(raf);
    finish?.();
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const y = Math.max(0, Math.min(target, max));
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || Math.abs(y - window.scrollY) < 4) {
      window.scrollTo(0, y);
      resolve();
      return;
    }
    const vh = window.innerHeight;

    const run = (from: number) => {
      const dist = y - from;
      const dur = Math.min(950, Math.max(560, Math.abs(dist) * 0.6));
      const t0 = performance.now();
      const stop = () => {
        cancelAnimationFrame(raf);
        window.removeEventListener("touchstart", stop);
        window.removeEventListener("wheel", stop);
        finish = null;
        resolve();
      };
      finish = stop;
      window.addEventListener("touchstart", stop, { passive: true });
      window.addEventListener("wheel", stop, { passive: true });
      const step = (now: number) => {
        const t = Math.min(1, (now - t0) / dur);
        window.scrollTo(0, from + dist * easeInOut(t));
        if (t < 1) raf = requestAnimationFrame(step);
        else stop();
      };
      raf = requestAnimationFrame(step);
    };

    if (Math.abs(y - window.scrollY) > vh * 2.2) {
      // long trip: dim the page, skip most of the distance, then glide the last stretch
      document.body.classList.add("jumping");
      setTimeout(() => {
        const from = y - Math.sign(y - window.scrollY) * vh * 0.9;
        window.scrollTo(0, from);
        requestAnimationFrame(() => {
          document.body.classList.remove("jumping");
          run(from);
        });
      }, 160);
    } else run(window.scrollY);
  });
}
