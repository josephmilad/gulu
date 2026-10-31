import type { Metadata } from "next";
import { Suspense } from "react";
import SavedGrid from "./SavedGrid";

export const metadata: Metadata = { title: "Saved" };

export default function SavedPage() {
  return (
    <div className="sec">
      <div className="wrap">
        <div className="head"><div><h2>Saved pieces</h2><p>Kept on this device only.</p></div></div>
      </div>
      <div className="tight">
        <Suspense fallback={null}>
          <SavedGrid />
        </Suspense>
      </div>
    </div>
  );
}
