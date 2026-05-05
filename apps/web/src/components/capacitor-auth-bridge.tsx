"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isCapacitorNative } from "@/lib/capacitor";

/**
 * Capacitor Auth Bridge — läuft NUR in der nativen App.
 *
 * Hintergrund: Google blockt OAuth in WebViews. Wir öffnen den Flow daher
 * in Chrome Custom Tabs und lassen Supabase via Custom-Scheme
 * `com.myarea365.app://auth/callback?code=...` zurück in die App redirecten.
 *
 * Dieser Hook hört auf das `appUrlOpen`-Event (wenn Android die App per
 * Deep-Link startet), tauscht den Code gegen eine Session, schließt den
 * Custom-Tab-Browser und navigiert in die App.
 */
export function CapacitorAuthBridge() {
  const router = useRouter();

  useEffect(() => {
    if (!isCapacitorNative()) return;

    let cleanup: (() => void) | undefined;

    void (async () => {
      const { App } = await import("@capacitor/app");
      const { Browser } = await import("@capacitor/browser");
      const supabase = createClient();

      const handle = await App.addListener("appUrlOpen", async ({ url }) => {
        if (!url.startsWith("com.myarea365.app://")) return;

        try {
          const parsed = new URL(url);
          const code = parsed.searchParams.get("code");
          const errorDesc =
            parsed.searchParams.get("error_description") ?? parsed.searchParams.get("error");

          await Browser.close().catch(() => {
            // Browser evtl. schon zu — ignorieren
          });

          if (errorDesc) {
            router.replace(`/login?error=${encodeURIComponent(errorDesc)}`);
            return;
          }
          if (!code) return;

          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            router.replace(`/login?error=${encodeURIComponent(error.message)}`);
            return;
          }

          // Profil-Check wie in /auth/callback: unvollständige Profile landen im Onboarding
          const {
            data: { user },
          } = await supabase.auth.getUser();
          if (user) {
            const { data: profile } = await supabase
              .from("users")
              .select("username, faction")
              .eq("id", user.id)
              .maybeSingle();
            if (!profile || !profile.faction || !profile.username) {
              router.replace("/onboarding");
              return;
            }
          }
          router.replace("/karte");
          router.refresh();
        } catch {
          // URL-Parsing fehlgeschlagen — nichts tun, User bleibt auf aktueller Seite
        }
      });

      cleanup = () => {
        void handle.remove();
      };
    })();

    return () => cleanup?.();
  }, [router]);

  return null;
}
