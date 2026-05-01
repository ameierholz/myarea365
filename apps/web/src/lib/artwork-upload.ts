// Direct-to-Storage Upload via Signed URL.
// Umgeht Vercels 4.5 MB Body-Limit fuer API-Routen (wichtig fuer Videos).

export async function uploadArtworkDirect(
  file: File,
  targetType: "archetype" | "item" | "material" | "marker" | "light" | "pin_theme" | "siegel" | "potion" | "rank" | "base_theme" | "building" | "resource" | "chest" | "stronghold" | "ui_icon" | "troop" | "nameplate" | "base_ring" | "loot_drop" | "resource_node",
  targetId: string,
  variant?: "neutral" | "male" | "female",
): Promise<{ ok: true; image_url: string | null; video_url: string | null; is_video: boolean } | { ok: false; error: string }> {
  try {
    // 1) Signed Upload URL holen
    const signRes = await fetch("/api/admin/artwork/sign", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        target_type: targetType,
        target_id: targetId,
        file_name: file.name,
        content_type: file.type || "application/octet-stream",
        variant,
      }),
    });
    if (!signRes.ok) {
      const j = await signRes.json().catch(() => ({}));
      return { ok: false, error: j.error || `sign_failed_${signRes.status}` };
    }
    const sign = await signRes.json() as { upload_url: string; token: string; path: string; is_video: boolean };

    // 2) Datei direkt zu Supabase Storage hochladen (kein Vercel in der Mitte)
    const upRes = await fetch(sign.upload_url, {
      method: "PUT",
      headers: {
        "content-type": file.type || "application/octet-stream",
        "x-upsert": "true",
      },
      body: file,
    });
    if (!upRes.ok) {
      const text = await upRes.text().catch(() => "");
      return { ok: false, error: `storage_upload_failed_${upRes.status}: ${text.slice(0, 200)}` };
    }

    // 3) Finalize: DB-Spalte setzen
    const finRes = await fetch("/api/admin/artwork", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        target_type: targetType,
        target_id: targetId,
        path: sign.path,
        is_video: sign.is_video,
        variant,
      }),
    });
    if (!finRes.ok) {
      const j = await finRes.json().catch(() => ({}));
      return { ok: false, error: j.error || `finalize_failed_${finRes.status}` };
    }
    const fin = await finRes.json() as { ok: boolean; image_url: string | null; video_url: string | null; is_video: boolean };
    return { ok: true, image_url: fin.image_url, video_url: fin.video_url, is_video: fin.is_video };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "unknown_error" };
  }
}
