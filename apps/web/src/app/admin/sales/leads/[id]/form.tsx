"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button, Input, Select, Textarea } from "../../../_components/ui";
import { appAlert, appConfirm } from "@/components/app-dialog";

type Lead = Record<string, string | number | null>;

export function LeadDetailForm({ lead }: { lead: Lead }) {
  const router = useRouter();
  const sb = createClient();
  const [pending, start] = useTransition();
  const [f, setF] = useState<Lead>(lead);

  function handle(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    setF({ ...f, [e.target.name]: e.target.value });
  }

  function save() {
    start(async () => {
      const patch = { ...f, value_eur: f.value_eur ? Number(f.value_eur) : null, updated_at: new Date().toISOString() };
      delete (patch as { id?: string }).id;
      delete (patch as { created_at?: string }).created_at;
      const { error } = await sb.from("sales_leads").update(patch).eq("id", lead.id as string);
      if (error) { appAlert(error.message); return; }
      await sb.from("admin_audit_log").insert({ action: "lead.update", target_type: "lead", target_id: lead.id as string, details: patch });
      router.refresh();
    });
  }

  async function remove() {
    if (!(await appConfirm({ message: "Lead wirklich löschen?", danger: true }))) return;
    start(async () => {
      await sb.from("sales_leads").delete().eq("id", lead.id as string);
      await sb.from("admin_audit_log").insert({ action: "lead.delete", target_type: "lead", target_id: lead.id as string });
      router.push("/admin/sales/leads");
    });
  }

  return (
    <div className="grid md:grid-cols-2 gap-3 max-w-2xl">
      <Field label="Shop-Name"><Input name="shop_name" value={String(f.shop_name ?? "")} onChange={handle} /></Field>
      <Field label="Status">
        <Select name="status" value={String(f.status ?? "new")} onChange={handle} className="w-full">
          <option value="new">Neu</option>
          <option value="contacted">Kontaktiert</option>
          <option value="demo_booked">Demo gebucht</option>
          <option value="proposal_sent">Angebot raus</option>
          <option value="won">Won</option>
          <option value="lost">Lost</option>
          <option value="ghosted">Ghosted</option>
        </Select>
      </Field>
      <Field label="Kontakt"><Input name="contact_name" value={String(f.contact_name ?? "")} onChange={handle} /></Field>
      <Field label="E-Mail"><Input name="contact_email" value={String(f.contact_email ?? "")} onChange={handle} /></Field>
      <Field label="Telefon"><Input name="contact_phone" value={String(f.contact_phone ?? "")} onChange={handle} /></Field>
      <Field label="Stadt"><Input name="city" value={String(f.city ?? "")} onChange={handle} /></Field>
      <Field label="Adresse"><Input name="address" value={String(f.address ?? "")} onChange={handle} /></Field>
      <Field label="PLZ"><Input name="zip" value={String(f.zip ?? "")} onChange={handle} /></Field>
      <Field label="Kategorie"><Input name="category" value={String(f.category ?? "")} onChange={handle} /></Field>
      <Field label="Wert (€/Monat)"><Input name="value_eur" type="number" value={String(f.value_eur ?? "")} onChange={handle} /></Field>
      <Field label="Nächste Aktion"><Input name="next_action_at" type="datetime-local" value={f.next_action_at ? String(f.next_action_at).slice(0, 16) : ""} onChange={handle} /></Field>
      <div className="md:col-span-2"><Field label="Notizen"><Textarea name="notes" defaultValue={String(f.notes ?? "")} rows={5} /></Field></div>
      <div className="md:col-span-2 flex gap-2 pt-2">
        <Button variant="primary" onClick={save} disabled={pending}>Speichern</Button>
        <Button variant="danger" onClick={remove} disabled={pending}>Löschen</Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-bold text-[#8b8fa3] uppercase block mb-1">{label}</span>
      {children}
    </label>
  );
}
