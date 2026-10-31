"use client";

import Link from "next/link";
import { useToast } from "@/lib/store";

export default function Toast() {
  const t = useToast();
  return (
    <div className={`toast${t ? " on" : ""}`} role="status">
      <span>{t?.text}</span>
      {t?.action && <Link href="/saved">View</Link>}
    </div>
  );
}
