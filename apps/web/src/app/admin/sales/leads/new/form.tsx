"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button, Input, Select, Textarea } from "../../../_components/ui";

export function LeadForm() {
  const router = useRouter();
  const sb = createClient();
  const [pending, start] = useTransition();
  const [f, setF] = useState({
    shop_name: "", contact_name: "", contact_email: "", contact_phone: "",
    address: "", city: "", zip: "", category: "", source: "website", status: "new",
    value_eur: "", notes: "",
  });

  function handle(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    setF({ ...f, [e.target.name]: e.target.value });
  }

  function save() {
    start(async () => {
      const { data, error } = await sb.from("sales_leads").insert({
        ...f,
        value_eur: f.value_eur ? Number(f.value_eur) : null,
      }).select("id").single();
      if (error) { alert(error.message); return; }
      await sb.from("admin_audit_log").insert({ action: "lead.create", target_type: "lead", target_id: data.id });
      router.push(`/admin/sales/leads/${data.id}`);
    });
  }

  return (
    <div className="grid md:grid-cols-2 gap-3 max-w-2xl">
      <Field label="Shop-Name *"><Input name="shop_name" onChange={handle} /></Field>
      <Field label="Kategorie"><Input name="category" onChange={handle} placeholder="Café, Sport, Bäckerei…" /></Field>
      <Field label="Kontakt-Name"><Input name="contact_name" onChange={handle} /></Field>
      <Field label="E-Mail"><Input name="contact_email" onChange={handle} type="email" /></Field>
      <Field label="Telefon"><Input name="contact_phone" onChange={handle} /></Field>
      <Field label="Adresse"><Input name="address" onChange={handle} /></Field>
      <Field label="PLZ"><Input name="zip" onChange={handle} /></Field>
      <Field label="Stadt"><Input name="city" onChange={handle} /></Field>
      <Field label="Quelle">
        <Select name="source" onChange={handle} className="w-full">
          <option value="website">Website</option>
          <option value="referral">Empfehlung</option>
          <option value="cold_outreach">Kaltakquise</option>
          <option value="trade_show">Messe</option>
          <option value="inbound_mail">Inbound-Mail</option>
        </Select>
      </Field>
      <Field label="Status">
        <Select name="status" onChange={handle} className="w-full">
          <option value="new">Neu</option>
          <option value="contacted">Kontaktiert</option>
          <option value="demo_booked">Demo gebucht</option>
          <option value="proposal_sent">Angebot raus</option>
        </Select>
      </Field>
      <Field label="Geschätzter Wert (€/Monat)"><Input name="value_eur" type="number" onChange={handle} /></Field>
      <div className="md:col-span-2"><Field label="Notizen"><Textarea name="notes" onChange={handle} rows={4} /></Field></div>
      <div className="md:col-span-2 pt-2">
        <Button variant="primary" onClick={save} disabled={pending || !f.shop_name}>Lead anlegen</Button>
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
