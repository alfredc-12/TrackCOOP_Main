import { Tags } from "lucide-react";
import { PortalRoutePage } from "@/components/portal/PortalRoutePage";

export default function BookkeeperFinancialCategoriesPage() {
  return (
    <PortalRoutePage
      eyebrow="Finance"
      title="Financial Categories"
      description="Maintain explicit categories for cooperative income, expenses, and reporting."
      icon={Tags}
    />
  );
}
