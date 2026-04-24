"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * AdSense-Slot-Component fuer MyArea365.
 *
 * Policy:
 * - Nie im aktiven Gameplay (Walk, Arena, Checkout, Walk-Summary).
 * - Wird ausgeblendet fuer Supporter-Tiers (Bronze / Silber / Gold).
 * - Nur AUF DESKTOP/Web sichtbar — in der nativen App laeuft AdMob statt AdSense.
 * - Ein "WERBUNG"-Label darueber fuer Transparenz (DSGVO / Fairness).
 *
 * Placements:
 *   ranking_list       — zwischen Leaderboard-Rows
 *   deals_list         — zwischen Deal-Cards
 *   public_profile     — auf /u/[username] unter den Stats
 *   legal_footer       — im Footer von /datenschutz, /impressum, /agb
 *
 * ENV: Pro Placement ein AdSense-Slot konfigurieren, sobald AdSense live ist:
 *   NEXT_PUBLIC_ADSENSE_SLOT_RANKING=1234567890
 *   NEXT_PUBLIC_ADSENSE_SLOT_DEALS=1234567890
 *   NEXT_PUBLIC_ADSENSE_SLOT_PROFILE=1234567890
 *   NEXT_PUBLIC_ADSENSE_SLOT_LEGAL=1234567890
 * Wenn kein Slot gesetzt ist, wird nichts gerendert (kein leerer Platzhalter).
 */

const ADSENSE_CLIENT = "ca-pub-9799640580685030";

export type AdPlacement = "ranking_list" | "deals_list" | "public_profile" | "legal_footer";

const SLOTS: Record<AdPlacement, string | undefined> = {
  ranking_list:   process.env.NEXT_PUBLIC_ADSENSE_SLOT_RANKING,
  deals_list:     process.env.NEXT_PUBLIC_ADSENSE_SLOT_DEALS,
  public_profile: process.env.NEXT_PUBLIC_ADSENSE_SLOT_PROFILE,
  legal_footer:   process.env.NEXT_PUBLIC_ADSENSE_SLOT_LEGAL,
};

type Props = {
  placement: AdPlacement;
  /** "in-article" schlank · "in-feed" breit (responsive). Default "in-feed". */
  format?: "in-feed" | "in-article";
  hideIf?: boolean;
};

export function AdSenseSlot({ placement, format = "in-feed", hideIf = false }: Props) {
  const slot = SLOTS[placement];
  const [supporter, setSupporter] = useState<string | null | undefined>(undefined);
  const pushed = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sb = createClient();
    (async () => {
      const { data: { user } } = await sb.auth.getUser();
      if (!user) { setSupporter(null); return; }
      const { data: u } = await sb.from("users").select("supporter_tier").eq("id", user.id).maybeSingle();
      setSupporter((u as { supporter_tier?: string | null } | null)?.supporter_tier ?? null);
    })();
  }, []);

  useEffect(() => {
    if (pushed.current) return;
    if (!slot || supporter === undefined || supporter) return;
    if (typeof window === "undefined") return;
    try {
      const w = window as unknown as { adsbygoogle?: unknown[] };
      w.adsbygoogle = w.adsbygoogle ?? [];
      w.adsbygoogle.push({});
      pushed.current = true;
    } catch { /* adsbygoogle script noch nicht bereit */ }
  }, [slot, supporter]);

  if (hideIf) return null;
  if (!slot) return null;
  if (supporter === undefined) return null;
  if (supporter) return null;

  return (
    <div
      style={{
        margin: "12px 0",
        padding: 4,
        borderRadius: 10,
        background: "rgba(30, 38, 60, 0.35)",
        border: "1px solid rgba(255,255,255,0.05)",
      }}
    >
      <div style={{ fontSize: 9, color: "#6c7590", letterSpacing: 1, marginBottom: 3, textAlign: "center" }}>
        WERBUNG
      </div>
      <ins
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={ADSENSE_CLIENT}
        data-ad-slot={slot}
        data-ad-format={format === "in-article" ? "fluid" : "auto"}
        data-ad-layout={format === "in-article" ? "in-article" : undefined}
        data-full-width-responsive="true"
      />
    </div>
  );
}
