import type { Response } from "express";
import { AppError } from "../../utils/app-error";
import { asyncHandler } from "../../utils/async-handler";
import type { MemberSelfService } from "./member-self.service";
import type { MemberPasswordInput, MemberProfileInput, MemberSupportInput } from "./member-self.types";

function requireAuth(auth: Express.Request["auth"]) {
  if (!auth) throw new AppError("Authentication is required", 401, "UNAUTHENTICATED");
  return auth;
}

function sendError(response: Response, error: unknown, fallback: string) {
  if (error instanceof AppError) {
    return response.status(error.statusCode).json({ error: error.message });
  }
  console.error(fallback, error);
  return response.status(500).json({ error: fallback });
}

export function createMemberSelfController(service: MemberSelfService) {
  return {
    dashboard: asyncHandler(async (request, response) => {
      try {
        return response.json(await service.dashboard(requireAuth(request.auth)));
      } catch (error) {
        return sendError(response, error, "Failed to fetch dashboard data");
      }
    }),

    activity: asyncHandler(async (request, response) => {
      try {
        return response.json(await service.activity(requireAuth(request.auth), request.query));
      } catch (error) {
        return sendError(response, error, "Failed to fetch activity data");
      }
    }),

    profile: asyncHandler(async (request, response) => {
      try {
        return response.json(await service.profile(requireAuth(request.auth)));
      } catch (error) {
        return sendError(response, error, "Failed to fetch profile");
      }
    }),

    updateProfile: asyncHandler(async (request, response) => {
      try {
        return response.json(
          await service.updateProfile(requireAuth(request.auth), (request.body ?? {}) as MemberProfileInput),
        );
      } catch (error) {
        return sendError(response, error, "Failed to update profile");
      }
    }),

    updatePassword: asyncHandler(async (request, response) => {
      try {
        return response.json(
          await service.updatePassword(requireAuth(request.auth), (request.body ?? {}) as MemberPasswordInput),
        );
      } catch (error) {
        return sendError(response, error, "Failed to update password");
      }
    }),

    listSupportTickets: asyncHandler(async (request, response) => {
      try {
        return response.json(await service.listSupportTickets(requireAuth(request.auth)));
      } catch (error) {
        return sendError(response, error, "Failed to fetch support tickets");
      }
    }),

    createSupportTicket: asyncHandler(async (request, response) => {
      try {
        return response.json(
          await service.createSupportTicket(requireAuth(request.auth), (request.body ?? {}) as MemberSupportInput),
        );
      } catch (error) {
        return sendError(response, error, "Failed to submit support ticket");
      }
    }),
  };
}
