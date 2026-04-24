"use client";

import Link from "next/link";
import { ShopDealsContent } from "@/components/shop-deals-content";

/**
 * /deals — öffentliche Standalone-Seite mit derselben UI wie das
 * Shop-Deals-Modal aus dem Dashboard. Bleibt für SEO + Bookmarks erreichbar.
 */
export default function DealsPage() {
  return (
    <main style={{ minHeight: "100vh", background: "#0F1115", color: "#F0F0F0", paddingBottom: 40 }}>
      <header style={{
        position: "sticky", top: 0, zIndex: 10,
        background: "rgba(15,17,21,0.95)", backdropFilter: "blur(12px)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        padding: "14px 20px",
      }}>
        <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <Link href="/dashboard" style={{ color: "#22D1C3", textDecoration: "none", fontSize: 13, fontWeight: 700 }}>
            ← zurück
          </Link>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, letterSpacing: 2, color: "#22D1C3", fontWeight: 900 }}>MYAREA365</div>
            <h1 style={{ fontSize: 20, fontWeight: 900, margin: 0 }}>Alle Deals in deiner Umgebung</h1>
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "16px 20px" }}>
        <ShopDealsContent />
      </div>
    </main>
  );
}
