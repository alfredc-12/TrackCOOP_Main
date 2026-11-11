import { Router } from "express";
import { z } from "zod";
import { createAuthenticate } from "../../middleware/authenticate";
import { requireRoles } from "../../middleware/authorize";
import { asyncHandler } from "../../utils/async-handler";
import { AppError } from "../../utils/app-error";
import { sendSuccess } from "../../utils/response";
import type { AuthService } from "../auth/auth.service";
import {
  createSettingsRepository,
  type SettingsRepository,
} from "./settings.repository";
import { byKey } from "./settings.registry";
const change = z
  .object({
    key: z.string().min(1).max(160),
    value: z.unknown(),
    expectedRevision: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();
function parse<T>(schema: z.ZodType<T>, input: unknown) {
  const r = schema.safeParse(input);
  if (!r.success)
    throw new AppError(
      "Review the setting values and reload if needed.",
      422,
      "INVALID_SETTINGS",
      r.error.issues.map((i) => ({
        field: i.path.join("."),
        message: i.message,
      })),
    );
  return r.data;
}
export function createSettingsRouter(
  auth: AuthService,
  repo: SettingsRepository = createSettingsRepository(),
) {
  const router = Router(),
    access = [createAuthenticate(auth), requireRoles("chairman")];
  const cropReferenceAccess = [
    createAuthenticate(auth),
    requireRoles("chairman", "bookkeeper"),
  ];
  router.use("/system-settings", (_r, res, next) => {
    res.setHeader("Cache-Control", "private, no-store");
    next();
  });
  router.get(
    "/system-settings/catalog",
    ...access,
    asyncHandler(async (_r, res) => sendSuccess(res, await repo.catalog())),
  );
  router.get(
    "/system-settings/high-value-crops",
    ...cropReferenceAccess,
    asyncHandler(async (_req, res) => {
      const catalog = await repo.catalog();
      const setting = catalog.settings.find(
        (entry) => entry.key === "inventory.high_value_crops",
      );
      const names = Array.isArray(setting?.value)
        ? setting.value.filter(
            (value): value is string => typeof value === "string",
          )
        : [];
      return sendSuccess(res, names);
    }),
  );
  router.get(
    "/system-settings",
    ...access,
    asyncHandler(async (req, res) => {
      const f = parse(
        z.object({
          page: z.coerce.number().int().min(1).default(1),
          pageSize: z.coerce.number().int().min(1).max(100).default(50),
          search: z.string().trim().max(190).default(""),
        }),
        req.query,
      );
      const all = (await repo.catalog()).settings
        .filter((s) => s.id !== null)
        .filter((s) =>
          (s.label + " " + s.key)
            .toLowerCase()
            .includes(f.search.toLowerCase()),
        );
      return sendSuccess(
        res,
        all.slice((f.page - 1) * f.pageSize, f.page * f.pageSize).map((s) => ({
          ...s,
          id: s.id,
          settingKey: s.key,
          settingValue:
            s.source === "invalid"
              ? null
              : typeof s.value === "string"
                ? s.value
                : JSON.stringify(s.value),
          settingGroup: byKey.get(s.key)!.group,
          valueType:
            s.kind === "number"
              ? "Number"
              : s.kind === "boolean"
                ? "Boolean"
                : s.kind === "text"
                  ? "String"
                  : "JSON",
        })),
        { meta: { total: all.length, page: f.page, pageSize: f.pageSize } },
      );
    }),
  );
  router.put(
    "/system-settings/batch",
    ...access,
    asyncHandler(async (req, res) => {
      const body = parse(
        z.object({ changes: z.array(change).min(1).max(32) }).strict(),
        req.body,
      );
      return sendSuccess(
        res,
        await repo.save(body.changes, req.auth!.user.id),
        { message: "Settings saved. The activity history has been updated." },
      );
    }),
  );
  router.put(
    "/system-settings",
    ...access,
    asyncHandler(async (req, res) => {
      const body = parse(
        z
          .object({
            settingKey: z.string().max(160),
            settingValue: z.string().nullable(),
            expectedRevision: z.string().regex(/^[a-f0-9]{64}$/),
            settingGroup: z.string().optional(),
            valueType: z.string().optional(),
            description: z.string().optional(),
            isPublic: z.literal(false).optional(),
            effectiveDate: z.string().nullable().optional(),
          })
          .strict(),
        req.body,
      );
      const d = byKey.get(body.settingKey);
      if (!d)
        throw new AppError(
          "This setting is not approved for editing.",
          422,
          "SETTING_NOT_APPROVED",
        );
      let value: unknown = body.settingValue;
      if (d.kind !== "text") {
        try {
          value = JSON.parse(body.settingValue ?? "null");
        } catch {
          throw new AppError(
            "Setting value is invalid.",
            422,
            "INVALID_SETTING_VALUE",
          );
        }
      }
      const data = await repo.save(
        [{ key: d.key, value, expectedRevision: body.expectedRevision }],
        req.auth!.user.id,
      );
      return sendSuccess(
        res,
        data.settings.find((s) => s.key === d.key),
        { message: "System setting saved" },
      );
    }),
  );
  return router;
}
