import cookieParser from "cookie-parser";
import cors, { type CorsOptions } from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
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
import { createFinanceRouter } from "./modules/finance/finance.routes";
import { createMemberIndicatorRouter } from "./modules/member-indicators/member-indicator.routes";
import { createMemberRouter } from "./modules/members/member.routes";
import { createPaymentReferenceRouter } from "./modules/payment-references/payment-reference.routes";
import { createShareCapitalRouter } from "./modules/share-capital/share-capital.routes";
import { createUserRouter } from "./modules/users/user.routes";
import { AppError } from "./utils/app-error";

type CreateAppOptions = {
  authService?: AuthService;
  databaseProbe?: DatabaseProbe;
  enableRequestLogging?: boolean;
  frontendUrl?: string;
};

function createCorsOptions(frontendUrl: string): CorsOptions {
  return {
    credentials: true,
    exposedHeaders: ["X-Request-ID"],
    origin(origin, callback) {
      if (!origin || origin === frontendUrl) {
        callback(null, true);
        return;
      }

      callback(new AppError("Request origin is not allowed", 403, "CORS_ORIGIN_DENIED"));
    },
  };
}

export function createApp(options: CreateAppOptions = {}) {
  const app = express();
  const frontendUrl = options.frontendUrl ?? env.FRONTEND_URL;

  app.disable("x-powered-by");

  if (env.TRUST_PROXY) {
    app.set("trust proxy", 1);
  }

  app.use(requestId);

  if (options.enableRequestLogging !== false) {
    app.use(requestLogger);
  }

  app.use(helmet());
  app.use(cors(createCorsOptions(frontendUrl)));
  app.use(validateOrigin(frontendUrl));
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

  app.use("/api/health", createHealthRouter(options.databaseProbe));
  app.use("/api/auth", createAuthRouter(options.authService));
  app.use("/api", createUserRouter(options.authService));
  app.use("/api", createMemberRouter(options.authService));
  app.use("/api", createMemberIndicatorRouter(options.authService));
  app.use("/api", createPaymentReferenceRouter(options.authService));
  app.use("/api", createShareCapitalRouter(options.authService));
  app.use("/api", createFinanceRouter(options.authService));

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

export const app = createApp();
