/**
 * Claim-Intensität in Prozent (0-100).
 *
 * Spiegelt die SQL-Funktion `public.claim_intensity(painted_at)` wider:
 * 100 % am Tag des Paintings, -10 % pro Tag, 0 % nach ≥ 10 Tagen.
 * Wird im Frontend genutzt, um den Alpha-Kanal der Crew-Farbe
 * bei verblassten Claims proportional zu reduzieren.
 */
export function claimIntensity(paintedAt: string | null | undefined): number {
  if (!paintedAt) return 100;
  const paintedMs = new Date(paintedAt).getTime();
  if (!Number.isFinite(paintedMs)) return 100;
  const days = Math.floor((Date.now() - paintedMs) / 86_400_000);
  return Math.max(0, 100 - days * 10);
}
