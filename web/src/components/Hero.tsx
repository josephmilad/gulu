"use client";

import Image from "next/image";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { EDITORIAL } from "@/data/pieces";

export default function Hero() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const imgY = useTransform(scrollYProgress, [0, 1], ["0%", "18%"]);
  const scale = useTransform(scrollYProgress, [0, 1], [1, 1.12]);
  const textY = useTransform(scrollYProgress, [0, 1], ["0%", "60%"]);
  const fade = useTransform(scrollYProgress, [0, 0.6], [1, 0]);

  const hero = EDITORIAL.hero[0];

  return (
    <section ref={ref} className="relative h-[92svh] min-h-[560px] w-full overflow-hidden bg-ink">
      <motion.div style={{ y: imgY, scale }} className="absolute inset-0">
        <Image
          src={hero.src}
          alt={hero.alt}
          fill
          priority
          sizes="100vw"
          className="object-cover object-[50%_30%]"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/55" />
      </motion.div>

      <motion.div
        style={{ y: textY, opacity: fade }}
        className="absolute inset-x-0 bottom-0 px-4 pb-10 text-white md:px-8 md:pb-14"
      >
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="eyebrow !text-white/70"
        >
          Curated by AI, approved by people
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2, delay: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="font-serif mt-3 max-w-[14ch] text-[13vw] leading-[0.92] tracking-[-0.02em] md:text-[7.5vw]"
        >
          Pieces worth knowing about.
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.9 }}
          className="mt-5 max-w-md text-sm leading-relaxed text-white/80 md:text-base"
        >
          Clothing, shoes and accessories with low hype and high regard. Scroll, tap, and go
          straight to the shop that sells them.
        </motion.p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.6, duration: 1 }}
        className="absolute bottom-6 right-4 hidden items-center gap-2 text-white/70 md:right-8 md:flex"
      >
        <span className="eyebrow !text-white/70">Scroll</span>
        <motion.span
          animate={{ y: [0, 6, 0] }}
          transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
          className="block h-6 w-px bg-white/70"
        />
      </motion.div>
    </section>
  );
}
