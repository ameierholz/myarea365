import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("ShopMeta");
  return {
    title: t("title"),
    description: t("description"),
    alternates: { canonical: "/shop" },
    openGraph: {
      title: t("ogTitle"),
      description: t("ogDescription"),
      images: ["/og-default.png"],
    },
  };
}

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return children;
}
