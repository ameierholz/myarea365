"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button, Select, Textarea } from "../../_components/ui";
import { appAlert, appConfirm } from "@/components/app-dialog";

export function RunnerActions({ userId, username, isBanned, shadowBanned, role, adminNotes }: {
  userId: string; username: string | null; isBanned: boolean; shadowBanned: boolean; role: string; adminNotes: string;
}) {
  const router = useRouter();
  const sb = createClient();
  const [pending, start] = useTransition();
  const [notes, setNotes] = useState(adminNotes);
  const [newRole, setNewRole] = useState(role);

  async function apply(updates: Record<string, unknown>, action: string) {
    start(async () => {
      const { error } = await sb.from("users").update(updates).eq("id", userId);
      if (error) { appAlert("Fehler: " + error.message); return; }
      await sb.from("admin_audit_log").insert({
        action, target_type: "user", target_id: userId, details: updates,
      });
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {isBanned ? (
          <Button variant="secondary" onClick={() => apply({ is_banned: false, banned_reason: null }, "user.unban")} disabled={pending}>
            🔓 Entsperren
          </Button>
        ) : (
          <Button variant="danger" onClick={() => {
            const reason = prompt("Grund der Sperre:");
            if (!reason) return;
            apply({ is_banned: true, banned_reason: reason }, "user.ban");
          }} disabled={pending}>
            🚫 Sperren
          </Button>
        )}

        <Button
          variant={shadowBanned ? "secondary" : "danger"}
          onClick={() => apply({ shadow_banned: !shadowBanned }, shadowBanned ? "user.shadow_unban" : "user.shadow_ban")}
          disabled={pending}
        >
          {shadowBanned ? "👁 Shadow-Ban aufheben" : "🌑 Shadow-Ban"}
        </Button>

        <Button variant="secondary" onClick={async () => {
          if (!(await appConfirm({ message: "XP wirklich zurücksetzen?", danger: true, confirmLabel: "Zurücksetzen" }))) return;
          apply({ total_xp: 0 }, "user.xp_reset");
        }} disabled={pending}>
          ↺ XP zurücksetzen
        </Button>
      </div>

      <div>
        <label className="text-xs font-bold text-[#8b8fa3] uppercase tracking-wider block mb-1">Rolle</label>
        <div className="flex gap-2">
          <Select value={newRole} onChange={(e) => setNewRole(e.target.value)}>
            <option value="user">User</option>
            <option value="support">Support</option>
            <option value="marketing">Marketing</option>
            <option value="sales">Sales</option>
            <option value="admin">Admin</option>
            <option value="super_admin">Super-Admin</option>
          </Select>
          <Button
            variant="primary" size="sm"
            disabled={pending || newRole === role}
            onClick={() => apply({ role: newRole }, "user.role_change")}
          >
            Speichern
          </Button>
        </div>
      </div>

      <div>
        <label className="text-xs font-bold text-[#8b8fa3] uppercase tracking-wider block mb-1">Admin-Notizen</label>
        <Textarea defaultValue={notes} rows={3} />
        <Button variant="secondary" size="sm" className="mt-2" onClick={() => {
          const v = (document.querySelector("textarea") as HTMLTextAreaElement)?.value ?? "";
          setNotes(v);
          apply({ admin_notes: v }, "user.notes_update");
        }} disabled={pending}>
          Notizen speichern
        </Button>
      </div>

      <div className="pt-2 border-t border-white/10 flex gap-2">
        <Button variant="ghost" size="sm" onClick={() => {
          navigator.clipboard.writeText(userId); appAlert("User-ID kopiert");
        }}>📋 ID kopieren</Button>
        {username && (
          <Button variant="ghost" size="sm" onClick={() => {
            window.open(`/@${username}`, "_blank");
          }}>🔗 Profil öffnen</Button>
        )}
      </div>
    </div>
  );
}
