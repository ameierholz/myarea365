// Generischer Prompt-Builder für die neuen Entity-Artwork-Tabs.
// Performance-Win: 1 gemeinsamer Boilerplate-Footer statt pro Slot wiederholt.
//
// Konzept: Subject (kurz, entity-spezifisch) + Style-Footer (1× definiert).
// Pro Generierung sparen wir ~150-300 Token verglichen mit den alten
// langen Prompts.

import { type TableTargetType } from "@/lib/artwork-targets";

// ────────────────────────────────────────────────────────────
// Shared Style-Footer — modern real-life-Stadt-Setting
// (KEIN Cyberpunk, KEIN Fantasy, kein Mittelalter)
// ────────────────────────────────────────────────────────────

export const STYLE_FOOTER_ICON = [
  "Style: bold modern flat-icon, single-subject, 3D-rendered with subtle ambient occlusion.",
  "Background: solid #00FF00 greenscreen for chroma-key.",
  "Format: 1024×1024, centered subject filling ~75% of canvas.",
  "Setting: contemporary urban (2026, real-life). NO cyberpunk lights, NO medieval gear, NO sci-fi tech.",
  "Negatives: no text, no watermark, no logo, no border, no human face close-up.",
].join(" ");

export const STYLE_FOOTER_HERO = [
  "Style: cinematic hero-banner, dramatic lighting, urban-modern setting (real 2026 city).",
  "Format: 1024×512 landscape, key subject in left third, copy-space on right.",
  "Background: gritty urban scene, depth-of-field blur, brand-aware colors (teal #22D1C3 + magenta #FF2D78 accents subtle).",
  "Negatives: no text, no logo, no copyright marks, no fantasy elements, no sci-fi, no cyberpunk neon-overload.",
].join(" ");

export const VIDEO_ANIMATION_HINT =
  "Animation: 3-second seamless loop. Subtle motion only (slow rotation, gentle pulse, light flicker). First and last frame pixel-identical. No audio.";

// ────────────────────────────────────────────────────────────
// Pro Entity-Type ein kurzer Subject-Hint.
// Wird mit name + description aus der DB kombiniert.
// ────────────────────────────────────────────────────────────

const SUBJECT_HINT: Partial<Record<TableTargetType, string>> = {
  pet:              "small companion creature/drone (chibi, friendly, sits next to player)",
  guardian_xp:      "stylized XP-token / power-up item (resource-style, glowing edge)",
  boss_raid:        "intimidating villain figure (urban warlord, full-body 3/4 angle, modern city outfit)",
  area_boss:        "mid-tier urban thug (street-fighter pose, modern clothing, single subject)",
  achievement:      "trophy/medal-style emblem (flat shield-shape with central icon)",
  quest:            "small task-marker icon (clipboard or scroll-substitute, modern paper-style)",
  research:         "modern lab/research icon (gear, microscope, data-tablet — pick most fitting)",
  mission:          "objective marker icon (waypoint pin or flag, modern street-level)",
  crew_challenge:   "competitive challenge emblem (crossed implements + glow ring)",
  gem_shop_item:    "premium pack icon (small box/wrapped item, magenta #FF2D78 accent)",
  daily_deal_pack:  "daily deal bundle icon (price-tag + content stack)",
  popup_offer:      "small promo gem-style icon (sparkle, attention-grabbing)",
  vip_offer:        "premium VIP icon (gold #FFD700 ribbon or crown-substitute, luxury feel)",
  monet_daily_deal:    "daily deal hero banner — featured product/character with price-burst",
  monet_gem_tier:      "gem-tier hero banner — stack of crystals with quantity emphasis",
  monet_seasonal:      "seasonal pack hero banner — themed scene matching season",
  monet_subscription:  "subscription hero banner — premium membership feeling, recurring-value vibe",
  monet_themed:        "themed pack hero banner — narrative scene tied to pack's story",
};

// ────────────────────────────────────────────────────────────
// Builder
// ────────────────────────────────────────────────────────────

export type EntityPromptInput = {
  targetType: TableTargetType;
  id: string;
  label: string;
  description: string | null;
  mode: "image" | "video";
};

export function buildEntityPrompt(input: EntityPromptInput): string {
  const hint = SUBJECT_HINT[input.targetType] ?? `single-subject icon for "${input.label}"`;
  const isHero = input.targetType.startsWith("monet_");
  const footer = isHero ? STYLE_FOOTER_HERO : STYLE_FOOTER_ICON;

  const subject = [
    `Subject: ${hint}.`,
    `Name: "${input.label}".`,
    input.description ? `Context: ${input.description}.` : null,
  ].filter(Boolean).join(" ");

  const parts = [subject, footer];
  if (input.mode === "video") parts.push(VIDEO_ANIMATION_HINT);
  return parts.join(" ");
}
