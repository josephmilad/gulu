"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { getPiece } from "@/data/pieces";
import { useLenis } from "./SmoothScroll";
import PieceDetail, { ShopButton } from "./PieceDetail";

function useIsDesktop() {
  const [desktop, setDesktop] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const update = () => setDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return desktop;
}

export default function PiecePanel() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const lenis = useLenis();
  const desktop = useIsDesktop();
  const slug = params.get("p");
  const piece = slug ? getPiece(slug) : undefined;
  const open = Boolean(piece);

  const close = useCallback(() => {
    const next = new URLSearchParams(params.toString());
    next.delete("p");
    router.replace(`${pathname}${next.toString() ? `?${next}` : ""}`, { scroll: false });
  }, [params, pathname, router]);

  const select = useCallback(
    (s: string) => {
      const next = new URLSearchParams(params.toString());
      next.set("p", s);
      router.replace(`${pathname}?${next}`, { scroll: false });
    },
    [params, pathname, router],
  );

  useEffect(() => {
    const l = lenis?.current;
    if (open) {
      l?.stop();
      document.body.style.overflow = "hidden";
    } else {
      l?.start();
      document.body.style.overflow = "";
    }
    return () => {
      l?.start();
      document.body.style.overflow = "";
    };
  }, [open, lenis]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  return (
    <AnimatePresence>
      {piece && (
        <>
          <motion.button
            key="scrim"
            type="button"
            aria-label="Close"
            onClick={close}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="fixed inset-0 z-50 bg-ink/30 backdrop-blur-[2px]"
          />
          <motion.aside
            key={`panel-${desktop ? "d" : "m"}`}
            role="dialog"
            aria-modal="true"
            initial={desktop ? { x: "100%" } : { y: "100%" }}
            animate={desktop ? { x: 0 } : { y: 0 }}
            exit={desktop ? { x: "100%" } : { y: "100%" }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-y-0 right-0 z-50 flex w-full flex-col bg-panel shadow-[0_0_80px_rgba(0,0,0,0.25)] md:w-[min(560px,44vw)]"
          >
            <div className="flex h-14 shrink-0 items-center justify-between border-b hairline px-5 md:h-16 md:px-8">
              <span className="font-serif text-lg">niche</span>
              <button
                type="button"
                onClick={close}
                className="u-link text-[13px]"
                aria-label="Close piece"
              >
                Close
              </button>
            </div>
            <div data-lenis-prevent className="flex-1 overflow-y-auto overscroll-contain">
              <motion.div
                key={piece.slug}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
              >
                <PieceDetail piece={piece} onSelect={select} compact />
              </motion.div>
            </div>
            <div className="absolute inset-x-0 bottom-0 border-t hairline bg-panel/90 p-4 backdrop-blur-xl md:px-6">
              <ShopButton piece={piece} floating />
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
