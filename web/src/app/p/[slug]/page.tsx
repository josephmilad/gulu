import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { PIECES, getPiece } from "@/data/pieces";
import PieceDetail from "@/components/PieceDetail";
import { img } from "@/lib/url";

export function generateStaticParams() {
  return PIECES.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps<"/p/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const piece = getPiece(slug);
  if (!piece) return {};
  return {
    title: `${piece.brand} ${piece.name}`,
    description: piece.why,
    openGraph: { images: [img(piece.images[0].src)] },
  };
}

export default async function PiecePage({ params }: PageProps<"/p/[slug]">) {
  const { slug } = await params;
  const piece = getPiece(slug);
  if (!piece) notFound();
  return (
    <div className="pt-20 pb-24 md:pt-28">
      <div className="mx-auto mb-6 max-w-6xl px-4 md:px-8">
        <Link href="/" className="u-link text-[13px]">
          ← Back to feed
        </Link>
      </div>
      <PieceDetail piece={piece} />
    </div>
  );
}
