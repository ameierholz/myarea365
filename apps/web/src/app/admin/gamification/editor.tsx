"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button, Input } from "../_components/ui";
import { appAlert, appConfirm } from "@/components/app-dialog";

type Entry = { key: string; value: unknown; description: string | null; updated_at: string };

export function GamificationEditor({ entries }: { entries: Entry[] }) {
  const router = useRouter();
  const sb = createClient();
  const [pending, start] = useTransition();
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(entries.map((e) => [e.key, JSON.stringify(e.value)]))
  );

  function save(key: string) {
    start(async () => {
      let parsed: unknown;
      try { parsed = JSON.parse(values[key]); } catch { appAlert("Ungültiges JSON"); return; }
      await sb.from("gamification_config").update({ value: parsed, updated_at: new Date().toISOString() }).eq("key", key);
      await sb.from("admin_audit_log").insert({ action: "gamification.update", target_type: "config", target_id: key, details: { value: parsed } });
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {entries.map((e) => (
        <div key={e.key} className="grid grid-cols-[2fr_3fr_auto_auto] gap-3 items-center py-2 border-b border-white/5 last:border-0">
          <div>
            <div className="font-mono text-sm text-white">{e.key}</div>
            <div className="text-xs text-[#8b8fa3]">{e.description}</div>
          </div>
          <Input value={values[e.key] ?? ""} onChange={(ev) => setValues({ ...values, [e.key]: ev.target.value })} className="font-mono" />
          <Button variant="primary" size="sm" onClick={() => save(e.key)} disabled={pending}>Speichern</Button>
          <div className="text-[11px] text-[#8b8fa3]">{new Date(e.updated_at).toLocaleDateString("de-DE")}</div>
        </div>
      ))}
    </div>
  );
}
