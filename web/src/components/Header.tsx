"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { motion, useMotionValueEvent, useScroll } from "framer-motion";

const NAV = [
  { href: "/", label: "Feed" },
  { href: "/styles", label: "Styles" },
  { href: "/about", label: "About" },
];

export default function Header() {
  const pathname = usePathname();
  const { scrollY } = useScroll();
  const [hidden, setHidden] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const overHero = pathname === "/" || pathname.startsWith("/styles/");
  const light = overHero && !scrolled;

  useMotionValueEvent(scrollY, "change", (y) => {
    const prev = scrollY.getPrevious() ?? 0;
    const hide = y > prev && y > 120;
    setHidden(hide);
    document.documentElement.toggleAttribute("data-header-hidden", hide);
    setScrolled(y > 24);
  });

  return (
    <motion.header
      animate={{ y: hidden ? "-100%" : "0%" }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className={`fixed inset-x-0 top-0 z-40 transition-[background-color,backdrop-filter,border-color,color] duration-500 ${
        scrolled
          ? "bg-bg/95 backdrop-blur-xl border-b hairline text-ink"
          : `bg-transparent border-b border-transparent ${light ? "text-white" : "text-ink"}`
      }`}
    >
      <div className="mx-auto flex h-14 max-w-[1800px] items-center justify-between px-4 md:h-16 md:px-8">
        <Link href="/" className="font-serif text-2xl leading-none tracking-tight md:text-[28px]">
          niche
        </Link>
        <nav className="flex items-center gap-6 text-[13px] md:gap-8">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="u-link"
              aria-current={pathname === n.href ? "true" : undefined}
            >
              {n.label}
            </Link>
          ))}
        </nav>
      </div>
    </motion.header>
  );
}
