"use client";

import { use, useEffect, useRef } from "react";
import QRCode from "qrcode";

export default function ShopQrPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const payload = `myarea:redeem:${id}`;

  useEffect(() => {
    if (!canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, payload, { width: 480, margin: 2, color: { dark: "#0F1115", light: "#FFFFFF" } }).catch(() => {});
  }, [payload]);

  return (
    <div style={{
      minHeight: "100vh", background: "#FFF", color: "#0F1115",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 30,
    }}>
      <div style={{
        maxWidth: 560, width: "100%", textAlign: "center",
        padding: 30, borderRadius: 16, border: "2px dashed #0F1115",
      }}>
        <div style={{ fontSize: 14, fontWeight: 900, letterSpacing: 2, color: "#22D1C3", marginBottom: 4 }}>MYAREA365 · EINLÖSEN</div>
        <div style={{ fontSize: 28, fontWeight: 900, marginBottom: 6 }}>Scanne mich für deinen Deal</div>
        <div style={{ fontSize: 13, color: "#555", marginBottom: 20 }}>
          Öffne die MyArea365-App → Shop öffnen → „Jetzt einlösen" → Kamera auf diesen Code
        </div>
        <canvas ref={canvasRef} width={480} height={480} style={{ margin: "0 auto" }} />
        <div style={{ fontSize: 11, color: "#888", marginTop: 16, fontFamily: "ui-monospace, monospace" }}>
          {payload}
        </div>
        <button
          onClick={() => window.print()}
          style={{
            marginTop: 20, padding: "12px 24px", borderRadius: 10,
            background: "#0F1115", color: "#FFF", border: "none",
            fontSize: 14, fontWeight: 900, cursor: "pointer",
          }}
        >
          🖨️ Drucken
        </button>
      </div>
      <style>{`@media print { button { display: none !important } }`}</style>
    </div>
  );
}
