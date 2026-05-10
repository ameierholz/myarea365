// Zentrale Z-Index-Stack-Verwaltung — vermeidet z-Index-Wildwuchs (war 3500–10000 pro Modal).
// Importiere `Z` und nutze `style={{ zIndex: Z.modal }}`.
//
// Layer-Ordnung von unten nach oben:
//   base/raised/fixed     — normale Page-Layer
//   bottomNav/fab         — sticky-UI (Bottom-Tabs, Floating-Action-Buttons)
//   tooltip               — kurze Hover-Hinweise, oberhalb sticky-UI aber unterhalb Modal
//   modal/modalNested...  — Overlays mit Backdrop. Nested = Modal-aus-Modal.
//   toast                 — System-Notifications, immer sichtbar
//   fxLayer               — Reward-Coin-Burst, Level-Up-Celebration, oberhalb allem

export const Z = {
  base: 0,
  raised: 10,
  fixed: 100,
  bottomNav: 500,
  fab: 800,

  tooltip: 8000,

  modal: 9000,
  modalNested: 9100,
  modalDeep: 9200,

  // Chat-Overlay — über Modals damit Spieler in jedem Screen lesen/antworten können
  chat: 9300,

  toast: 9500,
  fxLayer: 9800,
} as const;

export type ZLayer = keyof typeof Z;
