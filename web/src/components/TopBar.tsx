"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useSaved } from "@/lib/store";
import { scrollToGrid } from "@/lib/useShop";
import { HeartIcon, SearchIcon, XIcon } from "./Icons";

const NAV = [
  { href: "/", label: "Discover" },
  { href: "/styles", label: "Styles" },
  { href: "/#all", label: "All pieces" },
  { href: "/about", label: "How it works" },
];

function SearchField({ id }: { id: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const urlQ = params.get("q") || "";
  const [value, setValue] = useState(urlQ);
  const [prevUrlQ, setPrevUrlQ] = useState(urlQ);
  if (urlQ !== prevUrlQ) {
    setPrevUrlQ(urlQ);
    setValue(urlQ);
  }
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const commit = (v: string, jump: boolean) => {
    const next = new URLSearchParams(pathname === "/" ? params.toString() : "");
    if (v.trim()) next.set("q", v.trim());
    else next.delete("q");
    next.delete("p");
    const url = `/${next.toString() ? `?${next}` : ""}`;
    if (pathname === "/") router.replace(url, { scroll: false });
    else router.push(url);
    if (jump && v.trim()) setTimeout(scrollToGrid, 80);
  };

  return (
    <label className={`search${value ? " has" : ""}`}>
      <span className="sr">Search</span>
      <SearchIcon />
      <input
        id={id}
        type="search"
        placeholder="Search brands, pieces, styles"
        autoComplete="off"
        value={value}
        onChange={(e) => {
          const v = e.target.value;
          setValue(v);
          clearTimeout(timer.current);
          timer.current = setTimeout(() => commit(v, true), 200);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            clearTimeout(timer.current);
            commit(value, true);
            e.currentTarget.blur();
          }
        }}
      />
      <button type="button" className="clear" aria-label="Clear search" onClick={() => { setValue(""); commit("", false); }}>
        <XIcon />
      </button>
    </label>
  );
}

export default function TopBar() {
  const pathname = usePathname();
  const ref = useRef<HTMLElement>(null);
  const [edge, setEdge] = useState(false);
  const savedCount = useSaved().length;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => document.documentElement.style.setProperty("--hdr", `${el.offsetHeight}px`));
    ro.observe(el);
    const onScroll = () => setEdge(window.scrollY > 4);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      ro.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <header ref={ref} className={`top${edge ? " edge" : ""}`}>
      <div className="wrap">
        <div className="bar">
          <Link href="/" className="logo" aria-label="niche home">niche</Link>
          <nav className="dnav" aria-label="Main">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className={pathname === n.href ? "on" : ""}>
                {n.label}
              </Link>
            ))}
          </nav>
          <SearchField id="q-desktop" />
          <div className="tools">
            <Link href="/saved" className="ibtn" aria-label="Saved pieces">
              <HeartIcon />
              <span className={`count-badge${savedCount ? " on" : ""}`}>{savedCount}</span>
            </Link>
          </div>
        </div>
        <div className="msearch">
          <SearchField id="q-mobile" />
        </div>
      </div>
    </header>
  );
}
