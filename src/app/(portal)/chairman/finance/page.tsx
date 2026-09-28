import { DashboardClient } from "../dashboard/DashboardClient";
import { OperatingExpensesView } from "@/features/finance/OperatingExpensesView";

export default function ChairmanFinancePage() {
  return (
    <div className="space-y-6">
      <OperatingExpensesView />
      <DashboardClient mode="financial" />
    </div>
  );
}
