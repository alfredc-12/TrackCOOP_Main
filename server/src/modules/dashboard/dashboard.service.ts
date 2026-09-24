import type { DashboardRepository } from "./dashboard.repository";
import type { ChairmanDashboardData, DashboardFilters } from "./dashboard.types";

export class DashboardService {
  constructor(private readonly dashboardRepository: DashboardRepository) {}

  async getChairmanDashboardData(filters: DashboardFilters = {}): Promise<ChairmanDashboardData> {
    return await this.dashboardRepository.getChairmanDashboardData(filters);
  }
}
