"use client";

import { useCallback } from "react";
import { Modal, ModalHeader, ModalBody, Z } from "@/components/ui";
import { TroopsTab } from "@/components/base-modal/troops-tab";
import { ResourceHeader } from "@/components/base-modal/_resource-header";
import { fetchBaseMe } from "@/lib/base-me-cache";

const ACCENT = "#FF2D78";

export function TroopsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const reload = useCallback(async () => {
    await fetchBaseMe({ force: true });
  }, []);

  return (
    <Modal open={open} onClose={onClose} size="md" zIndex={Z.modal} reserveLeftSpace={372}>
      <ModalHeader title="Banditen" onClose={onClose} accent="accent" />
      <ResourceHeader />
      <ModalBody padding="padded">
        <TroopsTab accent={ACCENT} reload={reload} />
      </ModalBody>
    </Modal>
  );
}
