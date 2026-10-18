import Link from "next/link";
import { STYLES } from "@/data/styles";

export default function Marquee() {
  const items = [...STYLES, ...STYLES];
  return (
    <div className="marquee overflow-hidden border-y hairline py-3">
      <div className="marquee-track">
        {items.map((s, i) => (
          <Link
            key={`${s.slug}-${i}`}
            href={`/styles/${s.slug}`}
            className="font-serif mx-6 whitespace-nowrap text-xl text-ink-2 transition-colors hover:text-ink md:mx-10 md:text-2xl"
          >
            {s.name}
            <span className="ml-6 inline-block h-1 w-1 translate-y-[-6px] rounded-full bg-ink/40 md:ml-10" />
          </Link>
        ))}
      </div>
    </div>
  );
}
