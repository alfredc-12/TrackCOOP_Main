import { CreditCard, FileCheck2, TrendingUp, UsersRound } from "lucide-react";

const cards = [
  { label: "Active members", value: "18,420", icon: UsersRound },
  { label: "Monthly collections", value: "PHP 4.8M", icon: CreditCard },
  { label: "Compliance files", value: "94%", icon: FileCheck2 },
  { label: "Growth trend", value: "+12.4%", icon: TrendingUp },
];

export default function DashboardPage() {
  return (
    <div className="grid gap-6">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="rounded-lg border border-black/10 bg-white p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-[#657169]">{card.label}</p>
              <card.icon className="size-5 text-[#4d8f5b]" />
            </div>
            <p className="mt-6 text-3xl font-semibold tracking-normal">{card.value}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.4fr_0.6fr]">
        <div className="rounded-lg border border-black/10 bg-white p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Collection movement</h2>
            <span className="rounded-full bg-[#eef4e8] px-3 py-1 text-xs font-semibold text-[#3f704a]">
              Last 8 weeks
            </span>
          </div>
          <div className="mt-6 flex h-72 items-end gap-3">
            {[54, 62, 48, 71, 76, 82, 78, 91].map((height) => (
              <div key={height} className="flex flex-1 items-end">
                <div
                  className="w-full rounded-t-md bg-[#4d8f5b]"
                  style={{ height: `${height}%` }}
                />
              </div>
            ))}
          </div>
        </div>

        <div id="payments" className="rounded-lg border border-black/10 bg-[#17211c] p-5 text-white">
          <h2 className="text-xl font-semibold">Payment queue</h2>
          <div className="mt-6 grid gap-3">
            {["Loan amortization", "Share capital", "Membership dues"].map((item, index) => (
              <div key={item} className="rounded-md bg-white/8 p-4">
                <p className="font-semibold">{item}</p>
                <p className="mt-2 text-sm text-white/65">{12 + index * 7} pending reviews</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
