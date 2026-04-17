"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button, Input, Select, Textarea } from "../../../_components/ui";

type Segment = { id: string; name: string; description: string | null; sql_filter: string; user_count: number };

const TEMPLATES = [
  { id: "newsletter-monthly", label: "Kiez-Newsletter (Standard)" },
  { id: "monthly-stats", label: "Monats-Statistik" },
  { id: "custom", label: "Custom HTML" },
];

export function CampaignForm({ segments }: { segments: Segment[] }) {
  const router = useRouter();
  const sb = createClient();
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [segment, setSegment] = useState(segments[0]?.name ?? "all_users");
  const [template, setTemplate] = useState("newsletter-monthly");
  const [bodyHtml, setBodyHtml] = useState("");

  const selectedSeg = segments.find((s) => s.name === segment);

  function save(status: "draft" | "scheduled") {
    start(async () => {
      const { data, error } = await sb.from("email_campaigns").insert({
        name, subject, template,
        body_html: template === "custom" ? bodyHtml : null,
        segment_name: segment, segment_query: selectedSeg?.sql_filter ?? "true",
        status,
      }).select("id").single();
      if (error) { alert("Fehler: " + error.message); return; }
      await sb.from("admin_audit_log").insert({ action: "campaign.create", target_type: "campaign", target_id: data.id });
      router.push(`/admin/marketing/campaigns/${data.id}`);
    });
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <label className="text-xs font-bold text-[#8b8fa3] uppercase block mb-1">Interner Name</label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. 2026-05 Kiez-Newsletter" />
      </div>
      <div>
        <label className="text-xs font-bold text-[#8b8fa3] uppercase block mb-1">Betreff</label>
        <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Was steht diesen Monat an…" />
      </div>
      <div>
        <label className="text-xs font-bold text-[#8b8fa3] uppercase block mb-1">Segment</label>
        <Select value={segment} onChange={(e) => setSegment(e.target.value)} className="w-full">
          {segments.map((s) => <option key={s.id} value={s.name}>{s.description ?? s.name}</option>)}
        </Select>
        {selectedSeg && <div className="text-xs text-[#8b8fa3] mt-1">{selectedSeg.user_count} Empfänger · Filter: <code>{selectedSeg.sql_filter}</code></div>}
      </div>
      <div>
        <label className="text-xs font-bold text-[#8b8fa3] uppercase block mb-1">Template</label>
        <Select value={template} onChange={(e) => setTemplate(e.target.value)} className="w-full">
          {TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
        </Select>
      </div>
      {template === "custom" && (
        <div>
          <label className="text-xs font-bold text-[#8b8fa3] uppercase block mb-1">Custom HTML</label>
          <Textarea value={bodyHtml} onChange={(e) => setBodyHtml(e.currentTarget.value)} rows={12} placeholder="<html>…</html>" />
        </div>
      )}
      <div className="flex gap-2 pt-2">
        <Button variant="secondary" onClick={() => save("draft")} disabled={pending || !name || !subject}>Als Entwurf speichern</Button>
        <Button variant="primary" onClick={() => save("scheduled")} disabled={pending || !name || !subject}>Zum Versand planen</Button>
      </div>
    </div>
  );
}
