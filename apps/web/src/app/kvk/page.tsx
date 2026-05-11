import { redirect } from "next/navigation";

/**
 * /kvk — Alias-Route auf /saga.
 *
 * Die historische Bezeichnung war "KvK" (Kingdom-vs-Kingdom à la CoD/RoK).
 * Im Pivot zu MyArea365 wurde der Spielmodus auf "Metropol-Saga" umbenannt.
 * Damit Spieler die /kvk-URL aus alten Inboxen/Bookmarks weiter funktionieren
 * lassen, leiten wir hierhin um.
 */
export default function KvkRedirectPage() {
  redirect("/saga");
}
