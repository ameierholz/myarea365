"use client";

import { useCallback } from "react";
import { Modal, ModalHeader, ModalBody, Z } from "@/components/ui";
import { ResearchTab } from "@/components/base-modal/research-tab";
import { ResourceHeader } from "@/components/base-modal/_resource-header";
import { fetchBaseMe } from "@/lib/base-me-cache";
import { WeatherActionHint } from "@/components/weather-action-hint";

const ACCENT = "#22D1C3";

/**
 * ResearchModal — Standalone-Modal für die Forschung-UI vom Base-Tile.
 * Wraps die existierende ResearchTab in eine Modal-Shell, damit Spieler aus
 * dem Base-Hub direkt zur Forschung springen können ohne Umweg über BuildModal.
 */
export function ResearchModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const reload = useCallback(async () => {
    await fetchBaseMe({ force: true });
  }, []);

  return (
    <Modal open={open} onClose={onClose} size="md" zIndex={Z.modal} reserveLeftSpace={372}>
      <ModalHeader title="Forschung" onClose={onClose} accent="primary" />
      <ResourceHeader />
      <ModalBody padding="padded">
        <div style={{ marginBottom: 8, display: "flex", justifyContent: "center" }}>
          <WeatherActionHint lever="research" compact />
        </div>
        <ResearchTab accent={ACCENT} reload={reload} />
      </ModalBody>
    </Modal>
  );
}
