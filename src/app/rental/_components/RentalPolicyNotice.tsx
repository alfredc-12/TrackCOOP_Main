import { Info } from "lucide-react";
import { POLICY_NOTICE, PRICING_NOTICE } from "../_lib/rentalConstants";

export function RentalPolicyNotice({
  compact = false,
  tone = "sage",
}: {
  compact?: boolean;
  tone?: "sage" | "warning";
}) {
  const toneClass =
    tone === "warning"
      ? "border-amber-300 bg-amber-50 text-amber-900"
      : "border-[#c7d9a7] bg-[#f1f6dd] text-[#244c34]";

  return (
    <aside
      className={`rounded-2xl border p-4 ${toneClass}`}
      aria-label="Rental pricing and policy notice"
    >
      <div className="flex gap-3">
        <Info className="mt-0.5 size-5 shrink-0" />
        <div>
          <p className="font-bold">{PRICING_NOTICE}</p>
          {!compact && <p className="mt-1 text-sm leading-6">{POLICY_NOTICE}</p>}
        </div>
      </div>
    </aside>
  );
}
