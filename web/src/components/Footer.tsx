"use client";

import Link from "next/link";
import { showToast } from "@/lib/store";

export default function Footer() {
  return (
    <footer>
      <div className="wrap">
        <div className="fin">
          <div className="news">
            <h3>Five pieces a week</h3>
            <p>Chosen for regard, not reach. Unsubscribe any time.</p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                showToast("Thanks. Sign-ups open with the next build.");
                e.currentTarget.reset();
              }}
            >
              <label className="sr" htmlFor="email">Email address</label>
              <input id="email" type="email" required placeholder="Email address" />
              <button className="pill dark" type="submit">Join</button>
            </form>
          </div>
          <div className="fcols">
            <div><b>Explore</b><Link href="/styles">Styles</Link><Link href="/#all">All pieces</Link><Link href="/about">How it works</Link></div>
            <div><b>About</b><span>We link to the shops that sell each piece. We do not sell anything ourselves.</span></div>
          </div>
        </div>
        <div className="fine"><span>© 2026 niche</span><span>Preview build. Photos are placeholders.</span></div>
      </div>
    </footer>
  );
}
