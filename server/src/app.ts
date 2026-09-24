import cookieParser from "cookie-parser";
import cors, { type CorsOptions } from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import path from "node:path";
import { env } from "./config/env";
import { errorHandler } from "./middleware/error-handler";
import { notFound } from "./middleware/not-found";
import { validateOrigin } from "./middleware/origin-validation";
import { requestId } from "./middleware/request-id";
import { requestLogger } from "./middleware/request-logger";
import {
  createHealthRouter,
  type DatabaseProbe,
} from "./modules/health/health.routes";
import { createAuthRouter } from "./modules/auth/auth.routes";
import type { AuthService } from "./modules/auth/auth.service";
import { createCommunicationRouter } from "./modules/communication/communication.routes";
import { createFinanceRouter } from "./modules/finance/finance.routes";
import { createInventoryRouter } from "./modules/inventory/inventory.routes";
import { createLandingRouter } from "./modules/landing/landing.routes";
import { createDashboardRouter } from "./modules/dashboard/dashboard.routes";
import { createMemberIndicatorRouter } from "./modules/member-indicators/member-indicator.routes";
import { createMemberSelfRouter } from "./modules/member-self/member-self.routes";
import { createMemberRouter } from "./modules/members/member.routes";
import { createMembershipRouter } from "./modules/membership/membership.routes";
import type { MembershipService } from "./modules/membership/membership.service";
import { createMembershipApplicationRouter } from "./modules/membership-applications/membership-application.routes";
import type { MembershipApplicationService } from "./modules/membership-applications/membership-application.service";
import { createPaymongoRouter } from "./modules/paymongo/paymongo.routes";
import { createPaymongoWebhookRouter } from "./modules/paymongo/paymongo.webhook.routes";
import type { PaymongoWebhookService } from "./modules/paymongo/paymongo.webhook.service";
import { createPaymentReferenceRouter } from "./modules/payment-references/payment-reference.routes";
import { createPosRouter } from "./modules/pos/pos.routes";
import { createRecordsRouter } from "./modules/records/records.routes";
import { createRentalRouter } from "./modules/rental/rental.routes";
import { createShareCapitalRouter } from "./modules/share-capital/share-capital.routes";
import { createUserRouter } from "./modules/users/user.routes";
import { AppError } from "./utils/app-error";
import { LocalStorageProvider } from "./storage/local-storage-provider";
import { createPublicUploadHandler } from "./storage/public-upload-route";

type CreateAppOptions = {
  authService?: AuthService;
  authLoginRateLimit?: {
    limit: number;
    windowMinutes: number;
  };
  databaseProbe?: DatabaseProbe;
  enableRequestLogging?: boolean;
  frontendUrl?: string;
  membershipApplicationService?: MembershipApplicationService;
  membershipService?: MembershipService;
  paymongoWebhookService?: PaymongoWebhookService;
};

function createCorsOptions(allowedOrigins: string[]): CorsOptions {
  const allowed = new Set(allowedOrigins);
  return {
    credentials: true,
    exposedHeaders: ["X-Request-ID"],
    origin(origin, callback) {
      if (!origin || allowed.has(origin)) {
        callback(null, true);
        return;
      }

      callback(new AppError("Request origin is not allowed", 403, "CORS_ORIGIN_DENIED"));
    },
  };
}

export function createApp(options: CreateAppOptions = {}) {
  const app = express();
  const allowedOrigins = options.frontendUrl
    ? [options.frontendUrl]
    : env.CORS_ALLOWED_ORIGINS;

  app.disable("x-powered-by");

  if (env.TRUST_PROXY) {
    app.set("trust proxy", 1);
  }

  app.use(requestId);

  if (options.enableRequestLogging !== false) {
    app.use(requestLogger);
  }

  app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
  }));
  app.use("/api/webhooks/paymongo", createPaymongoWebhookRouter(options.paymongoWebhookService));
  app.use(cors(createCorsOptions(allowedOrigins)));
  app.use(validateOrigin(allowedOrigins));
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 500,
      standardHeaders: "draft-8",
      legacyHeaders: false,
    }),
  );
  app.use(express.json({ limit: env.REQUEST_BODY_LIMIT }));
  app.use(express.urlencoded({ extended: false, limit: env.REQUEST_BODY_LIMIT }));
  app.use(cookieParser());

  // Serve only public upload objects. Protected files are read through
  // authorized API handlers and are never exposed through express.static().
  if (env.STORAGE_DRIVER === "local") {
    const localStorage = new LocalStorageProvider();
    app.use("/uploads", express.static(localStorage.publicRoot()));
  }
  app.use("/uploads", createPublicUploadHandler());

  const publicUploadFolders = [
    "announcements",
    "gallery",
    "inventory",
    "partners-certifications",
    "rentals",
  ];
  for (const publicFolder of publicUploadFolders) {
    app.use(
      `/uploads/${publicFolder}`,
      express.static(path.join(process.cwd(), "public", "uploads", publicFolder)),
    );
    app.use(
      `/uploads/${publicFolder}`,
      express.static(path.join(process.cwd(), "storage", "public", "uploads", publicFolder)),
    );
    app.use(
      `/uploads/${publicFolder}`,
      express.static(path.join(process.cwd(), "storage", "uploads", publicFolder)),
    );
  }
  app.get(/^\/uploads\/product-[A-Za-z0-9_.-]+\.(?:jpg|jpeg|png|webp)$/i, (request, response) => {
    response.sendFile(path.join(process.cwd(), "public", request.path));
  });

  app.use("/api/health", createHealthRouter(options.databaseProbe));
  app.use("/api/auth", createAuthRouter(options.authService, {
    loginRateLimit: options.authLoginRateLimit,
  }));
  app.use("/api", createUserRouter(options.authService));
  app.use("/api", createMemberRouter(options.authService));
  app.use(
    "/api",
    createMembershipRouter(options.authService, options.membershipService),
  );
  app.use(
    "/api",
    createMembershipApplicationRouter(
      options.authService,
      options.membershipApplicationService,
    ),
  );
  app.use("/api", createMemberIndicatorRouter(options.authService));
  app.use("/api", createMemberSelfRouter(options.authService));
  app.use("/api", createPaymongoRouter(options.authService));
  app.use("/api", createPaymentReferenceRouter(options.authService));
  app.use("/api", createShareCapitalRouter(options.authService));
  app.use("/api", createFinanceRouter(options.authService));
  app.use("/api", createInventoryRouter(options.authService));
  app.use("/api", createPosRouter(options.authService));
  app.use("/api", createRentalRouter(options.authService));
  app.use("/api", createRecordsRouter(options.authService));
  app.use("/api", createCommunicationRouter(options.authService));
  app.use("/api", createLandingRouter(options.authService));
  app.use("/api", createDashboardRouter(options.authService));

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

export const app = createApp();
