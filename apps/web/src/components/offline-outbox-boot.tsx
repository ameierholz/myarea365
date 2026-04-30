"use client";

import { useEffect } from "react";
import { startAutoReplay } from "@/lib/offline-outbox";

/**
 * Bootet die Offline-Outbox: lauscht auf 'online'-Events + periodischen
 * Replay-Loop. Macht queued Mutations automatisch hochladbar sobald wieder Netz da ist.
 */
export function OfflineOutboxBoot() {
  useEffect(() => {
    return startAutoReplay();
  }, []);
  return null;
}
