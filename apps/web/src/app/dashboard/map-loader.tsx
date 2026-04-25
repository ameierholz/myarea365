"use client";

import { useTranslations } from "next-intl";

export function MapLoader() {
  const t = useTranslations("DashboardLoading");
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-deep text-text-muted">
      <div className="text-center">
        <div className="text-4xl mb-3 animate-pulse">🗺️</div>
        <div className="text-sm font-bold">{t("loadingMap")}</div>
      </div>
    </div>
  );
}
