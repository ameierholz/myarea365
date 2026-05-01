import { requireStaff } from "@/lib/admin";
import { PageTitle } from "../../_components/ui";
import { CohortsClient } from "./cohorts-client";

export const dynamic = "force-dynamic";

export default async function CohortsPage() {
  await requireStaff();
  return (
    <>
      <PageTitle title="🧮 Cohort-Builder" subtitle="Filter kombinieren → Größe sehen → CSV exportieren" />
      <CohortsClient />
    </>
  );
}
