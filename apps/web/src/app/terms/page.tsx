import { redirect, permanentRedirect } from "next/navigation";

/**
 * /terms = englischer Alias für /agb (AGB / Nutzungsbedingungen).
 * Damit Google Play / externe Tools eine /terms-URL erreichen.
 */
export default function TermsAlias() {
  permanentRedirect("/agb");
  redirect("/agb");
}
