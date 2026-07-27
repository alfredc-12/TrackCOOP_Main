import type { DashboardRepository } from "./dashboard.repository";
import type { ChairmanDashboardData } from "./dashboard.types";

export class DashboardService {
  constructor(private readonly dashboardRepository: DashboardRepository) {}

  async getChairmanDashboardData(period?: string): Promise<ChairmanDashboardData> {
    return await this.dashboardRepository.getChairmanDashboardData(period);
  }
}
