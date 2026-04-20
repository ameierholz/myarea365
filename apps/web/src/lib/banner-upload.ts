// Direct-to-Storage Upload fuer Runner-Profil-Banner.
export async function uploadRunnerBanner(file: File): Promise<
  | { ok: true; banner_url: string }
  | { ok: false; error: string }
> {
  try {
    const signRes = await fetch("/api/me/banner", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "sign", file_name: file.name, content_type: file.type || "image/jpeg" }),
    });
    if (!signRes.ok) {
      const j = await signRes.json().catch(() => ({}));
      return { ok: false, error: j.error || `sign_failed_${signRes.status}` };
    }
    const sign = await signRes.json() as { upload_url: string; path: string };

    const upRes = await fetch(sign.upload_url, {
      method: "PUT",
      headers: { "content-type": file.type || "image/jpeg", "x-upsert": "true" },
      body: file,
    });
    if (!upRes.ok) return { ok: false, error: `storage_upload_failed_${upRes.status}` };

    const finRes = await fetch("/api/me/banner", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "finalize", path: sign.path }),
    });
    if (!finRes.ok) {
      const j = await finRes.json().catch(() => ({}));
      return { ok: false, error: j.error || `finalize_failed_${finRes.status}` };
    }
    const fin = await finRes.json() as { ok: boolean; banner_url: string };
    return { ok: true, banner_url: fin.banner_url };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "unknown_error" };
  }
}

export async function deleteRunnerBanner(): Promise<boolean> {
  const res = await fetch("/api/me/banner", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "delete" }),
  });
  return res.ok;
}

export async function uploadRunnerAvatar(file: File): Promise<
  | { ok: true; avatar_url: string; status: "pending" }
  | { ok: false; error: string }
> {
  try {
    const signRes = await fetch("/api/me/avatar", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "sign", file_name: file.name, content_type: file.type || "image/jpeg" }),
    });
    if (!signRes.ok) return { ok: false, error: (await signRes.json().catch(() => ({}))).error || "sign_failed" };
    const sign = await signRes.json() as { upload_url: string; path: string };
    const upRes = await fetch(sign.upload_url, {
      method: "PUT",
      headers: { "content-type": file.type || "image/jpeg", "x-upsert": "true" },
      body: file,
    });
    if (!upRes.ok) return { ok: false, error: `storage_upload_failed_${upRes.status}` };
    const finRes = await fetch("/api/me/avatar", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "finalize", path: sign.path }),
    });
    if (!finRes.ok) return { ok: false, error: (await finRes.json().catch(() => ({}))).error || "finalize_failed" };
    const fin = await finRes.json() as { avatar_url: string; status: "pending" };
    return { ok: true, avatar_url: fin.avatar_url, status: fin.status };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "unknown_error" };
  }
}

export async function deleteRunnerAvatar(): Promise<boolean> {
  const res = await fetch("/api/me/avatar", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "delete" }),
  });
  return res.ok;
}
