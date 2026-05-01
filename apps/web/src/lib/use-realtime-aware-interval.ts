"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Polling-Hook der den Intervall automatisch drosselt, wenn der Supabase-
 * Realtime-Channel für die angegebene Tabelle aktiv subscribed ist.
 *
 * - Realtime aktiv → langsam (slowMs, default 60s als reine Watchdog-Frequenz)
 * - Realtime nicht verfügbar / disconnected → schnell (fastMs, default 15s)
 *
 * Reduziert bei 1000 concurrent Usern die HTTP-Polls um ~75%.
 */
export function useRealtimeAwareInterval(
  cb: () => void | Promise<void>,
  table: string,
  opts?: { fastMs?: number; slowMs?: number; channelName?: string; onChange?: () => void }
) {
  const fastMs = opts?.fastMs ?? 15_000;
  const slowMs = opts?.slowMs ?? 60_000;
  const channelName = opts?.channelName ?? `ma365-rt-${table}`;
  const [rtConnected, setRtConnected] = useState(false);

  useEffect(() => {
    const sb = createClient();
    const channel = sb
      .channel(channelName)
      .on("postgres_changes", { event: "*", schema: "public", table }, () => {
        opts?.onChange?.();
        void cb();
      })
      .subscribe((status) => {
        setRtConnected(status === "SUBSCRIBED");
      });
    return () => { void sb.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, channelName]);

  useEffect(() => {
    void cb();
    const id = setInterval(cb, rtConnected ? slowMs : fastMs);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rtConnected, fastMs, slowMs]);
}
