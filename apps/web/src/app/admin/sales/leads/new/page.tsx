import { PageTitle, Card } from "../../../_components/ui";
import { LeadForm } from "./form";

export default function NewLeadPage() {
  return (
    <>
      <PageTitle title="🎯 Neuer Lead" />
      <Card><LeadForm /></Card>
    </>
  );
}
