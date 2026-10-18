import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t hairline">
      <div className="mx-auto grid max-w-[1800px] gap-12 px-4 py-16 md:grid-cols-12 md:px-8 md:py-24">
        <div className="md:col-span-6">
          <p className="font-serif text-5xl tracking-tight md:text-7xl">niche</p>
          <p className="mt-4 max-w-sm text-[14px] leading-relaxed text-ink-2">
            Five pieces a week, chosen for regard rather than reach. No spam, unsubscribe any time.
          </p>
          <form className="mt-6 flex max-w-md border-b border-ink" action="#" method="post">
            <input
              type="email"
              required
              placeholder="Email address"
              className="w-full bg-transparent py-3 text-[14px] outline-none placeholder:text-muted"
            />
            <button type="submit" className="u-link py-3 text-[13px]">
              Join
            </button>
          </form>
        </div>
        <div className="grid grid-cols-2 gap-8 text-[13px] md:col-span-6 md:grid-cols-3">
          <div>
            <p className="eyebrow mb-3">Explore</p>
            <ul className="space-y-2">
              <li><Link className="u-link" href="/">Feed</Link></li>
              <li><Link className="u-link" href="/styles">Styles</Link></li>
              <li><Link className="u-link" href="/about">About</Link></li>
            </ul>
          </div>
          <div>
            <p className="eyebrow mb-3">Company</p>
            <ul className="space-y-2">
              <li><Link className="u-link" href="/about#disclosure">Affiliate disclosure</Link></li>
              <li><Link className="u-link" href="/about#imagery">Imagery</Link></li>
              <li><Link className="u-link" href="/about#privacy">Privacy</Link></li>
            </ul>
          </div>
          <div>
            <p className="eyebrow mb-3">Follow</p>
            <ul className="space-y-2">
              <li><a className="u-link" href="#">Instagram</a></li>
              <li><a className="u-link" href="#">TikTok</a></li>
              <li><a className="u-link" href="#">Pinterest</a></li>
            </ul>
          </div>
        </div>
      </div>
      <div className="mx-auto flex max-w-[1800px] items-center justify-between px-4 pb-8 text-[11px] text-muted md:px-8">
        <span>© 2026 niche</span>
        <span>We link out. We do not sell.</span>
      </div>
    </footer>
  );
}
