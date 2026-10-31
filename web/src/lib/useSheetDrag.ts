"use client";

import { useEffect, type RefObject } from "react";

/**
 * Lets a bottom sheet be pulled down to dismiss on touch screens. Dragging starts from
 * elements marked data-drag, or from the scroll area when it is already at the top.
 */
export function useSheetDrag(
  sheet: RefObject<HTMLElement | null>,
  scrim: RefObject<HTMLElement | null>,
  onClose: () => void,
  enabled: boolean,
) {
  useEffect(() => {
    const el = sheet.current;
    if (!el || !enabled) return;
    const body = el.querySelector<HTMLElement>(".sbody");
    let y0: number | null = null;
    let dy = 0;
    let t0 = 0;

    const start = (y: number, fromBody: boolean) => {
      if (window.innerWidth >= 900) return;
      if (fromBody && body && body.scrollTop > 0) return;
      y0 = y;
      dy = 0;
      t0 = Date.now();
    };
    const onHandle = (e: TouchEvent) => start(e.touches[0].clientY, false);
    const onBody = (e: TouchEvent) => start(e.touches[0].clientY, true);
    const onMove = (e: TouchEvent) => {
      if (y0 === null) return;
      dy = Math.max(0, e.touches[0].clientY - y0);
      if (dy > 4) {
        el.classList.add("dragging");
        el.style.transform = `translateY(${dy}px)`;
        if (scrim.current) scrim.current.style.opacity = String(Math.max(0, 1 - dy / 500));
        if (e.cancelable) e.preventDefault();
      }
    };
    const onEnd = () => {
      if (y0 === null) return;
      const v = dy / Math.max(1, Date.now() - t0);
      el.classList.remove("dragging");
      if (scrim.current) scrim.current.style.opacity = "";
      el.style.transform = "";
      y0 = null;
      if (dy > 120 || v > 0.6) onClose();
    };

    const handles = el.querySelectorAll<HTMLElement>("[data-drag]");
    handles.forEach((h) => h.addEventListener("touchstart", onHandle, { passive: true }));
    body?.addEventListener("touchstart", onBody, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd);
    el.addEventListener("touchcancel", onEnd);
    return () => {
      handles.forEach((h) => h.removeEventListener("touchstart", onHandle));
      body?.removeEventListener("touchstart", onBody);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, [sheet, scrim, onClose, enabled]);
}

/** Locks page scroll while a sheet or overlay is open. */
export function useScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return;
    document.body.classList.add("locked");
    return () => document.body.classList.remove("locked");
  }, [locked]);
}
