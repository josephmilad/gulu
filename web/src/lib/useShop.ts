"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { smoothScrollTo } from "./smoothScroll";

export function scrollToGrid() {
  const el = document.getElementById("all");
  const top = document.querySelector<HTMLElement>(".top");
  if (!el) return;
  const y = el.getBoundingClientRect().top + window.scrollY - (top?.offsetHeight ?? 0) + 1;
  return smoothScrollTo(y);
}

/** URL-backed shop state: filters, search and the open piece live in the query string. */
export function useShop() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const update = useCallback(
    (patch: Record<string, string | null>, opts: { push?: boolean; toGrid?: boolean } = {}) => {
      const next = new URLSearchParams(params.toString());
      Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
      const qs = next.toString();
      const url = `${pathname}${qs ? `?${qs}` : ""}`;
      if (opts.push) router.push(url, { scroll: false });
      else router.replace(url, { scroll: false });
      if (opts.toGrid) setTimeout(scrollToGrid, 80);
    },
    [params, pathname, router],
  );

  const openPiece = useCallback(
    (slug: string) => update({ p: slug }, { push: !params.get("p") }),
    [update, params],
  );

  return { params, pathname, update, openPiece };
}
