import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { RANKED, RANKED_MAP } from "@/lib/catalog";
import PieceDetail from "@/components/PieceDetail";
import ShopActions from "@/components/ShopActions";
import { ChevronLeft } from "@/components/Icons";

export function generateStaticParams() {
  return RANKED.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps<"/p/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const piece = RANKED_MAP[slug];
  if (!piece) return {};
  return { title: `${piece.brand} ${piece.name}`, description: piece.why, openGraph: { images: [piece.images[0].src] } };
}

export default async function PiecePage({ params }: PageProps<"/p/[slug]">) {
  const { slug } = await params;
  const piece = RANKED_MAP[slug];
  if (!piece) notFound();
  return (
    <div className="wrap page-pad">
      <Link href="/" className="more" style={{ display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 12 }}>
        <ChevronLeft /> Back to discover
      </Link>
      <div className="dsheet on" style={{ maxWidth: 560, margin: "0 auto", position: "static" }}>
        <Suspense fallback={null}>
          <PieceDetail piece={piece} />
          <div className="sfoot" style={{ position: "sticky", bottom: "calc(var(--nav) + env(safe-area-inset-bottom, 0px))", borderRadius: 999, border: 0, padding: "12px 0" }}>
            <ShopActions piece={piece} />
          </div>
        </Suspense>
      </div>
    </div>
  );
}
