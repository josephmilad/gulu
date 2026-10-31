"use client";

import { useSyncExternalStore } from "react";

/* Saved pieces: a per-viewer convenience kept in localStorage. */
const KEY = "niche-saved";
let saved: string[] | null = null;
const savedSubs = new Set<() => void>();
const EMPTY: string[] = [];

function loadSaved(): string[] {
  if (saved === null) {
    try {
      saved = JSON.parse(localStorage.getItem(KEY) || "[]");
    } catch {
      saved = [];
    }
  }
  return saved!;
}

export function useSaved(): string[] {
  return useSyncExternalStore(
    (cb) => {
      savedSubs.add(cb);
      return () => savedSubs.delete(cb);
    },
    loadSaved,
    () => EMPTY,
  );
}

export function toggleSaved(slug: string): boolean {
  const cur = loadSaved();
  const on = !cur.includes(slug);
  saved = on ? [...cur, slug] : cur.filter((s) => s !== slug);
  try {
    localStorage.setItem(KEY, JSON.stringify(saved));
  } catch {}
  savedSubs.forEach((cb) => cb());
  showToast(on ? "Saved to your list" : "Removed from saved", on);
  return on;
}

/* Toast */
type Toast = { text: string; action: boolean; id: number } | null;
let toast: Toast = null;
let timer: ReturnType<typeof setTimeout> | undefined;
const toastSubs = new Set<() => void>();

export function showToast(text: string, action = false) {
  toast = { text, action, id: Date.now() };
  toastSubs.forEach((cb) => cb());
  clearTimeout(timer);
  timer = setTimeout(() => {
    toast = null;
    toastSubs.forEach((cb) => cb());
  }, 2200);
}

export function useToast(): Toast {
  return useSyncExternalStore(
    (cb) => {
      toastSubs.add(cb);
      return () => toastSubs.delete(cb);
    },
    () => toast,
    () => null,
  );
}
