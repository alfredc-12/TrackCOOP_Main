      {/* -- ROW 4: Scenario Planner & Recent Activity ---------------------------- */}
      <div className="flex gap-4 mt-4">
        {/* -- LEFT COLUMN (1/3 Width) -- */}
        <div className="w-[33.33%] flex flex-col">

          {/* Recent Activity */}
          <div className="rounded-2xl border border-[#CAD8CB] bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md flex flex-col h-full">
            <SectionHeader title="Recent Activity" icon={Activity} />
            <div className="space-y-3 mt-4 flex-1">
              {/* Real Database Activity */}
              {(recentActivity ?? []).slice(0, 5).map((act, i) => {
                let color = "bg-[#EEF2EC]";
                if (act.type === "share_capital") color = "bg-blue-500";
                if (act.type === "membership") color = "bg-amber-500";

                return (
                  <div key={i} className="flex items-center justify-between text-[11px] pb-3 border-b border-[#EEF2EC] last:border-0 last:pb-0">
                    <div className="flex items-center gap-3">
                      <div className={size-2.5 rounded-full  ring-4 ring-[#F7F8F3] shrink-0} />
                      <span className="text-[#5D6D63]"><span className="font-bold text-[#123D2A]">{act.actor}</span> {act.title}</span>
                    </div>
                    <span className="text-[#78857d] font-medium shrink-0 ml-2">
                      {typeof act.activityDate === 'string' ? new Date(act.activityDate).toLocaleString() : act.activityDate.toLocaleString()}
                    </span>
                  </div>
                );
              })}

              {/* Fallback Latest Activity if Database is Empty */}
              {(recentActivity ?? []).length === 0 && [
                { type: "membership", title: "New member application", actor: "Marlo Condicion", date: "Today, 9:15 AM" },
                { type: "share_capital", title: "paid ?15,000 Share Capital", actor: "Juan Dela Cruz", date: "Today, 10:00 AM" },
                { type: "membership", title: "New member application", actor: "Maria Santos", date: "Today, 11:30 AM" },
                { type: "share_capital", title: "recorded", actor: "Sales transaction #TX-5541", date: "Today, 2:30 PM" },
                { type: "inventory", title: "Corn Seeds (50kg)", actor: "Inventory updated:", date: "Today, 3:45 PM" }
              ].map((act, i) => {
                let color = act.type === "share_capital" ? "bg-blue-500" : (act.type === "membership" ? "bg-amber-500" : "bg-teal-500");
                return (
                  <div key={mock-} className="flex items-center justify-between text-[11px] pb-3 border-b border-[#EEF2EC] last:border-0 last:pb-0">
                    <div className="flex items-center gap-3">
                      <div className={size-2.5 rounded-full  ring-4 ring-[#F7F8F3] shrink-0} />
                      <span className="text-[#5D6D63] leading-snug"><span className="font-bold text-[#123D2A] block">{act.actor}</span> {act.title}</span>
                    </div>
                    <span className="text-[#78857d] font-medium shrink-0 ml-2">{act.date}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* -- RIGHT COLUMN (2/3 Width) -- */}
        <div className="w-[66.67%] flex flex-col">

          {/* Scenario Planner */}
          <div className="rounded-2xl border border-[#CAD8CB] bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md flex flex-col h-full">
            <div className="flex items-center justify-between mb-4">
              <SectionHeader title="Cooperative Scenario Planner" />
              <div className="flex gap-4 text-[10px] font-bold text-[#5D6D63] items-center">
                <span>Target Members <input type="number" value={targetMembers} onChange={e => setTargetMembers(Number(e.target.value))} className="w-12 ml-1 text-right border-b border-[#CAD8CB] outline-none text-[#123D2A] bg-transparent" /></span>
                <span>Target Net Surplus <input type="number" value={targetSurplus} onChange={e => setTargetSurplus(Number(e.target.value))} className="w-16 ml-1 text-right border-b border-[#CAD8CB] outline-none text-[#123D2A] bg-transparent" /></span>
                <span>Additional Contribution
                  <select value={additionalContribution} onChange={e => setAdditionalContribution(Number(e.target.value))} className="ml-1 outline-none text-[#123D2A] bg-transparent font-bold">
                    <option value="5000">?5,000</option>
                    <option value="10000">?10,000</option>
                    <option value="15000">?15,000</option>
                  </select>
                </span>
              </div>
            </div>

            <div className="flex gap-6 flex-1">
              <div className="w-[70%] flex flex-col justify-center">
                <div className="flex text-[9px] font-bold text-[#5D6D63] mb-2 pb-1 border-b border-[#EEF2EC]">
                  <span className="w-[30%]">Scenario</span>
                  <span className="w-[40%] text-center">Projected Net Surplus</span>
                  <span className="w-[30%] text-right">Change vs Current</span>
                </div>
                {[
                  { label: "Increase Members", surplus: scenarioASurplus, growth: ((scenarioASurplus - curSurplus) / (curSurplus || 1)) * 100, p: pA },
                  { label: "Increase Contribution", surplus: scenarioBSurplus, growth: ((scenarioBSurplus - curSurplus) / (curSurplus || 1)) * 100, p: 30 },
                  { label: "Combined Strategy", surplus: scenarioCSurplus, growth: ((scenarioCSurplus - curSurplus) / (curSurplus || 1)) * 100, p: Math.min(100, pA + 30) },
                ].map(s => (
                  <div key={s.label} className="flex items-center text-[10px] py-2">
                    <span className="w-[30%] font-semibold text-[#5D6D63]">{s.label}</span>
                    <div className="w-[40%] flex items-center gap-2 pr-4">
                      <div className="flex-1 h-1.5 bg-[#EEF2EC] rounded-full overflow-hidden">
                        <div className="h-full bg-[#1F6B43]" style={{ width: ${s.p}% }} />
                      </div>
                      <span className="font-bold text-[#123D2A] w-14 text-right">{formatCurrency(s.surplus)}</span>
                    </div>
                    <span className="w-[30%] text-right"><DeltaBadge value={Math.round(s.growth * 10) / 10} className="justify-end" /></span>
                  </div>
                ))}
              </div>
              <div className="w-[30%] flex items-center justify-center border-l border-[#EEF2EC] pl-6">
                <div className="bg-[#F7F8F3] rounded-lg p-3 text-center border border-[#CAD8CB]">
                  <Settings2 className="size-5 text-[#1F6B43] mx-auto mb-1.5" />
                  <p className="text-[9px] text-[#5D6D63] leading-snug">Scenario results are based on current trends and user assumptions.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
