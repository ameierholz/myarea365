import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Quest-Progress-Bumps für die neue `quests`-Tabelle (Mig 00362).
 *
 * Ruft das RPC `bump_quest_progress(uid, metric, amount)` auf, das alle
 * aktiven User-Quests (main/side/daily/weekly/seasonal) mit passendem
 * target_metric um amount hochzählt und completed_at setzt wenn das Ziel
 * erreicht ist.
 *
 * Non-blocking: Fehler werden geschluckt — ein Quest-Bug darf den
 * Gameplay-Flow (Walk, Arena, Build, …) nicht brechen.
 */
export async function bumpQuestProgress(
  sb: SupabaseClient,
  userId: string,
  metric: string,
  amount: number = 1,
): Promise<{ updated: number; newly_completed: number }> {
  if (!userId || !metric || amount <= 0) return { updated: 0, newly_completed: 0 };
  try {
    const { data } = await sb.rpc("bump_quest_progress", {
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
 * Batch-Variante: feuert mehrere Quest-Metriken parallel ab.
 * Praktisch wenn ein Walk gleichzeitig segments_total + buildings_upgraded
 * + arena_wins etc. triggern soll.
 */
export async function bumpQuestProgressBatch(
  sb: SupabaseClient,
  userId: string,
  entries: Array<{ metric: string; amount: number }>,
): Promise<void> {
  if (!userId || entries.length === 0) return;
  await Promise.all(
    entries
      .filter((e) => e.amount > 0)
      .map((e) => bumpQuestProgress(sb, userId, e.metric, e.amount)),
  );
}
