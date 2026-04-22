import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Erhöht den Fortschritt aller aktiv zugewiesenen Missionen des Users
 * deren `target_metric` dem übergebenen Key entspricht.
 *
 * Non-blocking: Fehler werden geschluckt, damit kein Mission-Bug einen
 * Walk/Arena/Shop-Flow bricht.
 */
export async function bumpMissionProgress(
  sb: SupabaseClient,
  userId: string,
  metric: string,
  amount: number = 1,
): Promise<{ updated: number; newly_completed: number }> {
  if (!userId || !metric || amount <= 0) return { updated: 0, newly_completed: 0 };
  try {
    const { data } = await sb.rpc("bump_mission_progress", {
      p_user_id: userId,
      p_metric: metric,
      p_amount: amount,
    });
    const row = Array.isArray(data) && data[0] ? data[0] as { updated_count: number; newly_completed: number } : null;
    return { updated: row?.updated_count ?? 0, newly_completed: row?.newly_completed ?? 0 };
  } catch {
    return { updated: 0, newly_completed: 0 };
  }
}

/**
 * Batch-Variante: feuert mehrere Metriken parallel ab.
 * Praktisch wenn ein Walk gleichzeitig new_streets, new_segments, km, territories etc. triggert.
 */
export async function bumpMissionProgressBatch(
  sb: SupabaseClient,
  userId: string,
  entries: Array<{ metric: string; amount: number }>,
): Promise<void> {
  if (!userId || entries.length === 0) return;
  await Promise.all(
    entries
      .filter((e) => e.amount > 0)
      .map((e) => bumpMissionProgress(sb, userId, e.metric, e.amount)),
  );
}
