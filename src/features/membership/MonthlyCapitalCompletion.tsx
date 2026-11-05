"use client";
import { useEffect, useState } from "react";
import { Activity, Info } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { apiRequest } from "@/lib/api-client";
import { Button } from "@/components/ui/Button";
type Month = {
  month: string;
  applications: number;
  incomplete: number;
  reminder: number;
  overdue: number;
  completed: number;
  outstanding: number;
};
export function MonthlyCapitalCompletion({
  start,
  end,
  sectors = [],
  barangays = [],
  membershipType = "",
}: {
  start: string;
  end: string;
  sectors?: string[];
  barangays?: string[];
  membershipType?: string;
}) {
  const [data, setData] = useState<Month[] | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const sectorFilter = sectors.join(",");
  const barangayFilter = barangays.join(",");
  useEffect(() => {
    let active = true;
    apiRequest<{ months: Month[] }>(
      `/api/chairman/membership-capital/monthly?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}&sectors=${encodeURIComponent(sectorFilter)}&barangays=${encodeURIComponent(barangayFilter)}&membershipType=${encodeURIComponent(membershipType)}`,
    )
      .then((r) => {
        if (active) {
          setData(r.months);
          setError(false);
        }
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [start, end, retry, sectorFilter, barangayFilter, membershipType]);
  return (
    <section className="coop-panel p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <Activity className="size-5" aria-hidden="true" />
          Capital completion by month
        </h2>
        <details className="relative text-sm">
          <summary
            className="cursor-pointer"
            aria-label="Capital completion reporting scope"
          >
            <Info className="size-5" aria-hidden="true" />
          </summary>
          <p className="absolute right-0 z-10 w-64 rounded-lg bg-white p-4 shadow-lg">
            New-policy applications and upgrade requests, using the reporting
            period. Legacy obligations are excluded for review. Each reporting
            month uses the evidence recorded by its end.
          </p>
        </details>
      </div>
      {error ? (
        <div role="alert">
          Unable to load capital completion.
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setRetry((v) => v + 1)}
          >
            Retry
          </Button>
        </div>
      ) : !data ? (
        <p role="status">Loading capital completion…</p>
      ) : (
        <>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="month" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar
                  dataKey="incomplete"
                  name="Incomplete"
                  fill="var(--coop-muted)"
                />
                <Bar
                  dataKey="reminder"
                  name="Reminder"
                  fill="var(--coop-warning)"
                />
                <Bar
                  dataKey="overdue"
                  name="Overdue"
                  fill="var(--coop-danger)"
                />
                <Bar
                  dataKey="completed"
                  name="Completed"
                  fill="var(--coop-green)"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer font-bold">
              Monthly figures
            </summary>
            <div
              className="mt-3 overflow-x-auto"
              tabIndex={0}
              role="region"
              aria-label="Monthly capital figures"
            >
              <table className="w-full text-right text-sm">
                <thead>
                  <tr>
                    {[
                      "Month",
                      "Applications",
                      "Incomplete",
                      "Reminder",
                      "Overdue",
                      "Completed",
                      "Outstanding",
                    ].map((label) => (
                      <th key={label} className="p-2">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.map((m) => (
                    <tr key={m.month} className="border-t border-coop-border">
                      {[
                        m.month,
                        m.applications,
                        m.incomplete,
                        m.reminder,
                        m.overdue,
                        m.completed,
                        new Intl.NumberFormat("en-PH", {
                          style: "currency",
                          currency: "PHP",
                        }).format(m.outstanding),
                      ].map((value, i) => (
                        <td key={i} className="p-2 tabular-nums">
                          {value}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </section>
  );
}
