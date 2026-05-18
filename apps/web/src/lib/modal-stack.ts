/**
 * MODAL-STACK — globaler Counter für offene Modals.
 *
 * Wird von ui/Modal.tsx beim Mount/Unmount inkrementiert/dekrementiert.
 * Konsumenten (z.B. ChatWidget) reagieren auf die Tiefe, um sich bei
 * verschachtelten Modals zu verstecken.
 */

import { useEffect, useState } from "react";

let _depth = 0;
const _listeners = new Set<(d: number) => void>();

export function pushModalStack(): void {
  _depth++;
  _listeners.forEach((l) => l(_depth));
}

export function popModalStack(): void {
  _depth = Math.max(0, _depth - 1);
  _listeners.forEach((l) => l(_depth));
}

/**
 * Hook: liefert die aktuelle Modal-Stack-Tiefe.
 * 0 = kein Modal offen, 1 = ein Modal, 2+ = nested.
 *
 * SSR-safe: initial 0, useEffect synct nach Mount.
 */
export function useModalStackDepth(): number {
  const [depth, setDepth] = useState(0);
  useEffect(() => {
    setDepth(_depth);
    const sub = (d: number) => setDepth(d);
    _listeners.add(sub);
    return () => { _listeners.delete(sub); };
  }, []);
  return depth;
}

// ════════════════════════════════════════════════════════════════════
// FULLSCREEN-LAYER (separat vom Modal-Stack)
//
// Für vollflächige Overlays (FullscreenMapModal), die — anders als die
// rechtsbündigen ui/Modal-basierten Sheets — keinen Platz für den
// Chat-Hub links unten lassen. ChatWidget liest diesen Counter und
// versteckt sich, solange ein Fullscreen-Layer offen ist.
// ════════════════════════════════════════════════════════════════════

let _fsDepth = 0;
const _fsListeners = new Set<(d: number) => void>();

export function pushFullscreenLayer(): void {
  _fsDepth++;
  _fsListeners.forEach((l) => l(_fsDepth));
}

export function popFullscreenLayer(): void {
  _fsDepth = Math.max(0, _fsDepth - 1);
  _fsListeners.forEach((l) => l(_fsDepth));
}

export function useFullscreenLayerOpen(): boolean {
  const [depth, setDepth] = useState(0);
  useEffect(() => {
    setDepth(_fsDepth);
    const sub = (d: number) => setDepth(d);
    _fsListeners.add(sub);
    return () => { _fsListeners.delete(sub); };
  }, []);
  return depth > 0;
}

// ════════════════════════════════════════════════════════════════════
// HUD-HIDE (separat von Fullscreen-Layer)
//
// Für Modals, die zwar den globalen Karten-HUD verstecken müssen
// (Crew-Modal, Inventar, Shop, etc.) — aber den Chat-Hub SICHTBAR
// lassen sollen, weil das Modal "um den Chat herum" gebaut ist.
// KartenHud reagiert via useHudHidden() und entfernt sich.
// ════════════════════════════════════════════════════════════════════

let _hudHideDepth = 0;
const _hudHideListeners = new Set<(d: number) => void>();

export function pushHudHide(): void {
  _hudHideDepth++;
  _hudHideListeners.forEach((l) => l(_hudHideDepth));
}

export function popHudHide(): void {
  _hudHideDepth = Math.max(0, _hudHideDepth - 1);
  _hudHideListeners.forEach((l) => l(_hudHideDepth));
}

export function useHudHidden(): boolean {
  const [depth, setDepth] = useState(0);
  useEffect(() => {
    setDepth(_hudHideDepth);
    const sub = (d: number) => setDepth(d);
    _hudHideListeners.add(sub);
    return () => { _hudHideListeners.delete(sub); };
  }, []);
  return depth > 0;
}
