import { getLocale, getTranslations } from "next-intl/server";
import { buildSeoMetadata } from "@/lib/seo-meta";
import type { Locale } from "@/i18n/config";
import { OnboardingClient } from "./onboarding-client";

export async function generateMetadata() {
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("OnboardingPage");
  return buildSeoMetadata({
    path: "onboarding",
    title: (t.has("metaTitle") ? t("metaTitle") : "Onboarding") + " · MyArea365",
    description: t.has("metaDescription")
      ? t("metaDescription")
      : "Wähle deine Fraktion und stelle dein Profil ein — startklar in wenigen Schritten.",
    locale,
    index: true,
  });
}

export default function Page() {
  return <OnboardingClient />;
}
