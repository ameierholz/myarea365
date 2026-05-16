"use client";

/**
 * useSupabaseRealtime — duenner Wrapper um Supabase postgres_changes.
 * Abonniert eine Tabelle (optional mit Filter) und ruft onEvent bei jedem
 * INSERT/UPDATE/DELETE auf.
 *
 * Beispiel:
 *   useSupabaseRealtime({
 *     table: "rallies",
 *     filter: `crew_id=eq.${crewId}`,
 *   }, (event, row) => { ... });
 *
 * Channel-Name wird automatisch aus table + filter generiert. Auto-Cleanup
 * beim Unmount + bei deps-Wechsel.
 */

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

export type RealtimeEvent = "INSERT" | "UPDATE" | "DELETE" | "*";

export type RealtimeHookConfig = {
  table: string;
  /** Optional Postgres-Filter (siehe Supabase Realtime Filter-Syntax). */
  filter?: string;
  /** Schema, default 'public'. */
  schema?: string;
  /** Welche Events; default '*' (alle). */
  event?: RealtimeEvent;
  /** Channel-Name override. Default: ma365-rt-<table>-<filter>. */
  channel?: string;
};

export function useSupabaseRealtime<T extends Record<string, unknown> = Record<string, unknown>>(
  config: RealtimeHookConfig | null,
  onEvent: (
    event: "INSERT" | "UPDATE" | "DELETE",
    newRow: T | null,
    oldRow: T | null,
  ) => void,
) {
  const cbRef = useRef(onEvent);
  useEffect(() => { cbRef.current = onEvent; }, [onEvent]);

  const cfgKey = config ? `${config.schema ?? "public"}.${config.table}|${config.filter ?? ""}|${config.event ?? "*"}` : null;

  useEffect(() => {
    if (!config) return;
    const sb = createClient();
    const channelName = config.channel ?? `ma365-rt-${config.table}-${(config.filter ?? "all").replace(/[^a-zA-Z0-9_-]/g, "_")}`;
    const ch = sb.channel(channelName).on(
      "postgres_changes",
      {
        event: config.event ?? "*",
        schema: config.schema ?? "public",
        table: config.table,
        ...(config.filter ? { filter: config.filter } : {}),
      },
      (payload: RealtimePostgresChangesPayload<T>) => {
        const ev = payload.eventType as "INSERT" | "UPDATE" | "DELETE";
        const newRow = (payload.new && Object.keys(payload.new).length > 0 ? payload.new : null) as T | null;
        const oldRow = (payload.old && Object.keys(payload.old).length > 0 ? payload.old : null) as T | null;
        cbRef.current(ev, newRow, oldRow);
      },
    ).subscribe();
    return () => { void sb.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfgKey]);
}
