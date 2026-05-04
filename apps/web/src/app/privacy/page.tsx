import { redirect, permanentRedirect } from "next/navigation";

/**
 * /privacy = englischer Alias für /datenschutz.
 * Google Play Store erwartet eine /privacy-URL — wir leiten dauerhaft weiter,
 * damit der Inhalt nur an einer Stelle gepflegt wird.
 */
export default function PrivacyAlias() {
  permanentRedirect("/datenschutz");
  // unreachable, nur für TS:
  redirect("/datenschutz");
}
