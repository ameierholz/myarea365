"use client";

import { useEffect } from "react";
import { applyAllPrefs } from "@/lib/prefs";

export function PrefsBoot() {
  useEffect(() => {
    applyAllPrefs();
  }, []);
  return null;
}
