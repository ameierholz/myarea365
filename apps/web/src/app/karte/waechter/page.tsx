import { WaechterClient } from "./waechter-client";
import { FullscreenFrame } from "../_components/fullscreen-frame";

export const dynamic = "force-dynamic";

export default function WaechterPage() {
  return (
    <FullscreenFrame title="Wächter" theme="arena" bgSlot="karte_waechter_bg">
      <WaechterClient />
    </FullscreenFrame>
  );
}
