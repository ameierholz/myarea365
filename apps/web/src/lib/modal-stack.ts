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
