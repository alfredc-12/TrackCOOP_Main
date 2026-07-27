import { PageHeader } from "@/components/portal/PageHeader";
import { DashboardClient } from "./DashboardClient";

export default function ChairmanDashboardPage() {
  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Overview"
        title="Chairman Dashboard"
        description="Oversight for member growth, payments, operations, and cooperative activity."
      />
      <DashboardClient />
    </div>
  );
}
