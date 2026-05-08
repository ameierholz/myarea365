"use client";

import { useEffect, useState, useCallback } from "react";
import { Modal, ModalHeader, ModalBody, Z } from "@/components/ui";

type LegalPage = "impressum" | "datenschutz" | "agb";

const TITLE: Record<LegalPage, string> = {
  impressum:   "Impressum",
  datenschutz: "Datenschutzerklärung",
  agb:         "AGB — Nutzungsbedingungen",
};

let openFn: ((page: LegalPage) => void) | null = null;

export function openLegalModal(page: LegalPage) {
  openFn?.(page);
}

export function LegalModal() {
  const [page, setPage] = useState<LegalPage | null>(null);

  useEffect(() => {
    openFn = (p) => setPage(p);
    return () => { openFn = null; };
  }, []);

  const close = useCallback(() => setPage(null), []);

  useEffect(() => {
    if (!page) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [page, close]);

  if (!page) return null;

  return (
    <Modal open={!!page} onClose={close} size="xl" zIndex={Z.modal}>
      <ModalHeader title={TITLE[page]} onClose={close} accent="primary" />
      <ModalBody padding="flush" scrollable={false}>
        <iframe
          src={`/${page}`}
          title={TITLE[page]}
          style={{
            display: "block",
            width: "100%",
            height: "calc(100vh - 120px)",
            maxHeight: "calc(100vh - 120px)",
            border: "none",
            background: "transparent",
          }}
        />
      </ModalBody>
    </Modal>
  );
}
