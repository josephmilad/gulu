import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
      <p className="eyebrow">404</p>
      <h1 className="font-serif mt-3 text-4xl md:text-6xl">Not in the archive.</h1>
      <Link href="/" className="u-link mt-8 text-[13px]">
        Back to the feed
      </Link>
    </div>
  );
}
