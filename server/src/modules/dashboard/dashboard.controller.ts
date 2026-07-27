import type { Request, Response, NextFunction } from "express";
import type { DashboardService } from "./dashboard.service";
import { AppError } from "../../utils/app-error";

export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  getChairmanDashboard = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const period = req.query.period as string | undefined;
      const data = await this.dashboardService.getChairmanDashboardData(period);
      res.json({
        success: true,
        data,
        message: "Chairman dashboard metrics loaded",
        meta: {},
      });
    } catch (error) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({ error: error.message });
      } else {
        console.error("Dashboard error:", error);
        res.status(500).json({ error: "Internal server error" });
      }
    }
  };
}
