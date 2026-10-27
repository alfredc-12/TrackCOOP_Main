import { SeasonalAnalyticsClient } from "@/features/planning/SeasonalAnalyticsClient";

export default function BookkeeperSeasonalAnalyticsPage() {
  return <SeasonalAnalyticsClient canManageSeasons={false} />;
}
