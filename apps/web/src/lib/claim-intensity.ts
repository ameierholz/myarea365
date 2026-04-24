/**
 * Claim-Intensität in Prozent (0-100).
 *
 * Spiegelt die SQL-Funktion `public.claim_intensity_v2(painted_at, owner_id)` wider:
 * - 👑 Kronenwacht-Buff "Beständig": -7 %/Tag → 14 Tage Lebensdauer
 * - Standard (Gossenbund / unaligned): -10 %/Tag → 10 Tage Lebensdauer
 * Frontend nutzt den Wert für den Alpha-Kanal der Crew-Farbe.
 */
export function claimIntensity(
  paintedAt: string | null | undefined,
  ownerFaction?: string | null,
): number {
  if (!paintedAt) return 100;
  const paintedMs = new Date(paintedAt).getTime();
  if (!Number.isFinite(paintedMs)) return 100;
  const days = Math.floor((Date.now() - paintedMs) / 86_400_000);
  const isKronenwacht = ownerFaction === "kronenwacht" || ownerFaction === "vanguard";
  const decayPerDay = isKronenwacht ? 7 : 10;
  return Math.max(0, 100 - days * decayPerDay);
}
