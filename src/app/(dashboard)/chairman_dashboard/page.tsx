import { CreditCard, FileCheck2, TrendingUp, UsersRound } from "lucide-react";
import InventoryManagement from "./chairman_pos";

const cards = [
  { label: "Active members", value: "18,420", icon: UsersRound },
  { label: "Monthly collections", value: "PHP 4.8M", icon: CreditCard },
  { label: "Compliance files", value: "94%", icon: FileCheck2 },
  { label: "Growth trend", value: "+12.4%", icon: TrendingUp },
];

export default async function ChairmanDashboardPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const params = await searchParams;
  const tab = params.tab || "dashboard";

  // If the user clicks Rental/POS tab, render the inventory component
  if (tab === "rental-pos") {
    return <InventoryManagement />;
  }

  // Handle other tabs
  if (tab !== "dashboard") {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] bg-white rounded-xl border border-gray-100 shadow-sm p-8">
        <h2 className="text-3xl font-bold text-[#1e293b] capitalize">{tab.replace('-', ' ')}</h2>
        <p className="text-gray-500 mt-3 text-lg">This module is currently under development.</p>
      </div>
    );
  }

  // Default Dashboard content (literally empty as requested)
  return <div />;
}
