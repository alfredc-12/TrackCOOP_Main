import type { Request, Response, NextFunction } from "express";
import type { DashboardService } from "./dashboard.service";
import { AppError } from "../../utils/app-error";

export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  getChairmanDashboard = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.dashboardService.getChairmanDashboardData({
        period: typeof req.query.period === "string" ? req.query.period : undefined,
        barangay: typeof req.query.barangay === "string" ? req.query.barangay : null,
        memberStatus: typeof req.query.memberStatus === "string" ? req.query.memberStatus : null,
        memberType: typeof req.query.memberType === "string" ? req.query.memberType : null,
      });
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
