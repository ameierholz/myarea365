import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component – ignore
          }
        },
      },
    }
  );
}

/**
 * Read-Replica-Client für read-heavy Endpoints (Active-Fetches, Listen).
 * Nutzt SUPABASE_READ_REPLICA_URL wenn gesetzt, fällt sonst auf den
 * Primary-Client zurück. RLS funktioniert auf Replicas identisch.
 *
 * Aktivierung (Supabase Pro+): Dashboard → Settings → Infrastructure →
 * Read Replicas → Add Replica (eu-central-1). URL kopieren und in Vercel
 * als SUPABASE_READ_REPLICA_URL setzen.
 *
 * Verwendung in API-Routes:
 *   const sb = await createReadClient(); // statt createClient()
 *   const { data } = await sb.from("...").select("...");
 */
export async function createReadClient() {
  const replicaUrl = process.env.SUPABASE_READ_REPLICA_URL;
  if (!replicaUrl) return createClient();

  const cookieStore = await cookies();
  return createServerClient(
    replicaUrl,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll() { /* read-only — keine Cookie-Updates */ },
      },
    }
  );
}
