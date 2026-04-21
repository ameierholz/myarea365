import { PageTitle, Card } from "../_components/ui";
import { BroadcastsClient } from "./broadcasts-client";

export const dynamic = "force-dynamic";

export default function BroadcastsPage() {
  return (
    <>
      <PageTitle title="📢 Broadcasts" subtitle="Segment-basierte Push-/In-App-Nachrichten" />
      <Card>
        <BroadcastsClient />
      </Card>
    </>
  );
}
