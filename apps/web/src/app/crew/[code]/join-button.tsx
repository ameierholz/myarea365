"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const COOKIE = "myarea-pending-crew";

export function CrewJoinButton({ crewId, code, accent }: { crewId: string; code: string; accent: string }) {
  const router = useRouter();
  const sb = createClient();
  const [pending, start] = useTransition();
  const [joined, setJoined] = useState(false);

  async function join() {
    start(async () => {
      const { data: { user } } = await sb.auth.getUser();
      if (!user) {
        document.cookie = `${COOKIE}=${code};path=/;max-age=${60 * 60 * 24 * 7};samesite=lax`;
        router.push(`/?ref=CREW-${code}`);
        return;
      }
      await sb.from("crew_members").upsert({ crew_id: crewId, user_id: user.id, role: "member" });
      await sb.from("users").update({ current_crew_id: crewId }).eq("id", user.id);
      // Pending-Territorien upgraden — Solo-Polygone werden jetzt mit Crew und XP aktiviert
      try { await sb.rpc("promote_pending_territories", { p_user_id: user.id }); } catch { /* stumm */ }
      setJoined(true);
      setTimeout(() => router.push("/dashboard"), 1200);
    });
  }

  if (joined) {
    return (
      <div className="w-full p-3 rounded-xl font-bold text-center" style={{ background: accent, color: "#0F1115" }}>
        ✓ Beigetreten! Leite weiter…
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <button
        onClick={join}
        disabled={pending}
        className="w-full py-3 rounded-xl font-black text-base"
        style={{ background: accent, color: "#0F1115", opacity: pending ? 0.6 : 1 }}
      >
        {pending ? "…" : "Crew beitreten"}
      </button>
      <Link href="/#start" className="block text-xs text-center text-text-muted hover:text-white">
        Noch keinen Account? Kostenlos registrieren →
      </Link>
    </div>
  );
}
