"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSaved } from "@/lib/store";
import { GridIcon, HeartIcon, HomeIcon, SearchIcon } from "./Icons";

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const count = useSaved().length;
  const search = () => {
    const focus = () => document.getElementById("q-mobile")?.focus();
    if (pathname !== "/") {
      router.push("/");
      setTimeout(focus, 400);
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
      setTimeout(focus, 350);
    }
  };
  return (
    <nav className="bnav" aria-label="App">
      <Link href="/" className={pathname === "/" ? "on" : ""}><HomeIcon /><span>Discover</span></Link>
      <button type="button" onClick={search}><SearchIcon /><span>Search</span></button>
      <Link href="/saved" className={pathname === "/saved" ? "on" : ""}>
        <HeartIcon /><span>Saved</span><span className={`count-badge${count ? " on" : ""}`}>{count}</span>
      </Link>
      <Link href="/styles" className={pathname.startsWith("/styles") ? "on" : ""}><GridIcon /><span>Styles</span></Link>
    </nav>
  );
}
