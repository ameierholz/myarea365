import { BegleiterClient } from "./begleiter-client";
import { FullscreenFrame } from "../_components/fullscreen-frame";

export const dynamic = "force-dynamic";

export default function BegleiterPage() {
  return (
    <FullscreenFrame title="Begleiter" theme="arena" bgSlot="karte_waechter_bg">
      <BegleiterClient />
    </FullscreenFrame>
  );
}
