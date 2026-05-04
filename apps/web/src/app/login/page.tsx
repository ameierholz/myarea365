import { getLocale, getTranslations } from "next-intl/server";
import { buildSeoMetadata } from "@/lib/seo-meta";
import type { Locale } from "@/i18n/config";
import { LoginClient } from "./login-client";

export async function generateMetadata() {
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("LoginPage");
  return buildSeoMetadata({
    path: "login",
    title: t("title") + " · MyArea365",
    description: t("subtitle"),
    locale,
    index: true,
  });
}

export default function Page() {
  return <LoginClient />;
}
