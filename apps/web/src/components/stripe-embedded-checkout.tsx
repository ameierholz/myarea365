"use client";

import { useEffect, useState } from "react";
import { loadStripe, type Stripe as StripeJs } from "@stripe/stripe-js";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";

let stripePromise: Promise<StripeJs | null> | null = null;
function getStripeJs() {
  if (!stripePromise) {
    const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    stripePromise = key ? loadStripe(key) : Promise.resolve(null);
  }
  return stripePromise;
}

export function StripeCheckoutModal({ clientSecret, onClose }: {
  clientSecret: string;
  onClose: () => void;
}) {
  const [stripe, setStripe] = useState<StripeJs | null>(null);

  useEffect(() => {
    let cancelled = false;
    getStripeJs().then((s) => { if (!cancelled) setStripe(s); });
    return () => { cancelled = true; };
  }, []);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 3000,
        background: "rgba(15,17,21,0.85)", backdropFilter: "blur(10px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
        animation: "appDialogFade 0.2s ease-out",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 560, maxHeight: "90vh", overflow: "hidden",
          background: "#FFF", borderRadius: 16,
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
          position: "relative",
        }}
      >
        <button
          onClick={onClose}
          aria-label="Schließen"
          style={{
            position: "absolute", top: 8, right: 8, zIndex: 2,
            background: "rgba(0,0,0,0.6)", color: "#FFF",
            border: "none", borderRadius: 999,
            width: 32, height: 32, fontSize: 18, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >✕</button>
        <div style={{ maxHeight: "90vh", overflowY: "auto" }}>
          {stripe && clientSecret ? (
            <EmbeddedCheckoutProvider stripe={stripe} options={{ clientSecret }}>
              <EmbeddedCheckout />
            </EmbeddedCheckoutProvider>
          ) : (
            <div style={{ padding: 60, textAlign: "center", color: "#666" }}>Lädt Zahlungsfenster…</div>
          )}
        </div>
      </div>
    </div>
  );
}
