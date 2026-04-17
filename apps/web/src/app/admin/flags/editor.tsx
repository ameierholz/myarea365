"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "../_components/ui";

type Flag = { key: string; description: string | null; enabled: boolean; rollout_percent: number; updated_at: string };

export function FlagsEditor({ flags }: { flags: Flag[] }) {
  const router = useRouter();
  const sb = createClient();
  const [pending, start] = useTransition();

  function toggle(key: string, enabled: boolean) {
    start(async () => {
      await sb.from("feature_flags").update({ enabled, updated_at: new Date().toISOString() }).eq("key", key);
      await sb.from("admin_audit_log").insert({ action: "flag.toggle", target_type: "flag", target_id: key, details: { enabled } });
      router.refresh();
    });
  }

  function setRollout(key: string, percent: number) {
    start(async () => {
      await sb.from("feature_flags").update({ rollout_percent: percent, updated_at: new Date().toISOString() }).eq("key", key);
      await sb.from("admin_audit_log").insert({ action: "flag.rollout", target_type: "flag", target_id: key, details: { percent } });
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      {flags.map((f) => (
        <div key={f.key} className="grid grid-cols-[2fr_auto_auto_auto] gap-4 items-center py-3 border-b border-white/5 last:border-0">
          <div>
            <div className="font-mono text-sm text-white">{f.key}</div>
            <div className="text-xs text-[#8b8fa3]">{f.description}</div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#8b8fa3]">Rollout:</span>
            <input
              type="number" min={0} max={100} defaultValue={f.rollout_percent}
              className="w-16 bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white"
              onBlur={(e) => setRollout(f.key, parseInt(e.target.value) || 0)}
            />
            <span className="text-xs text-[#8b8fa3]">%</span>
          </div>
          <Badge tone={f.enabled ? "success" : "neutral"}>{f.enabled ? "AN" : "AUS"}</Badge>
          <button
            onClick={() => toggle(f.key, !f.enabled)}
            disabled={pending}
            style={{
              width: 44, height: 24, borderRadius: 12,
              background: f.enabled ? "#22D1C3" : "rgba(255,255,255,0.1)",
              position: "relative", transition: "background 0.2s", border: "none", cursor: "pointer",
            }}
          >
            <div style={{
              position: "absolute", top: 2, left: f.enabled ? 22 : 2,
              width: 20, height: 20, borderRadius: 10, background: "#FFF", transition: "left 0.2s",
            }} />
          </button>
        </div>
      ))}
    </div>
  );
}
