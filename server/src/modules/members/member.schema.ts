import { SECTORS } from "../membership-policy/membership-sectors";
import { z } from "zod";
import { isoDateSchema, refineDateRange } from "../../utils/people-filters";

export const membershipTypes = ["Associate", "True Member"] as const;
export const approvalStatuses = ["Pending", "Approved", "Rejected", "Needs Information"] as const;
export const officialMemberStatuses = [
  "Pending",
  "Active",
  "Inactive",
  "Suspended",
  "Terminated",
] as const;

const nullableText = (max: number) => z.string().trim().max(max).nullable().optional();
const optionalDate = z.iso.date().nullable().optional();

export const accountLinkFilters = ["linked", "unlinked"] as const;
export const historySources = ["All", "Application", "Member", "Account"] as const;
export const historyChangeTypes = [
  "application-status",
  "member-status",
  "membership-type",
  "account-status",
  "account-role",
] as const;

/** Filters shared by the directory list and its KPI summary so both always cover the same population. */
const memberFilterShape = {
  search: z.string().trim().min(1).max(190).optional(),
  approvalStatus: z.enum(approvalStatuses).optional(),
  officialMemberStatus: z.enum(officialMemberStatuses).optional(),
  membershipType: z.enum(membershipTypes).optional(),
  barangay: z.string().trim().min(1).max(120).optional(),
  /** The primary sector, or `Unspecified` for profiles without one. */
  sector: z.string().trim().min(1).max(100).optional(),
  /** `unlinked` = a member profile with no user account; a linked but Pending account still counts as linked. */
  accountLink: z.enum(accountLinkFilters).optional(),
  /** Inclusive Asia/Manila dates for `approved_at`. */
  approvedFrom: isoDateSchema.optional(),
  approvedTo: isoDateSchema.optional(),
};

export const listMembersQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().positive().max(100).default(20),
    ...memberFilterShape,
    sortBy: z
      .enum(["fullName", "memberCode", "createdAt", "applicationDate"])
      .default("createdAt"),
    sortDirection: z.enum(["asc", "desc"]).default("desc"),
  })
  .superRefine(refineDateRange("approvedFrom", "approvedTo"));

export const memberSummaryQuerySchema = z
  .object(memberFilterShape)
  .superRefine(refineDateRange("approvedFrom", "approvedTo"));

export const memberProfileSchema = z.object({
  userId: nullableText(30),
  memberCode: z.string().trim().min(2).max(60),
  fullName: z.string().trim().min(2).max(190),
  contactNumber: nullableText(40),
  email: z.email().max(190).nullable().optional(),
  barangay: nullableText(120),
  municipality: z.string().trim().min(2).max(120).default("Nasugbu"),
  province: z.string().trim().min(2).max(120).default("Batangas"),
  sector: nullableText(100),
  sectors: z.array(z.enum(SECTORS)).min(1).max(6).optional(),
  membershipType: z.enum(membershipTypes).default("Associate"),
  approvalStatus: z.enum(approvalStatuses).default("Pending"),
  officialMemberStatus: z.enum(officialMemberStatuses).default("Pending"),
  applicationDate: optionalDate,
  trueMemberSince: optionalDate,
  shareCapitalDeadline: optionalDate,
  notes: nullableText(2000),
});

export const updateMemberProfileSchema = memberProfileSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  { message: "At least one member field is required" },
);

export const updateMemberApprovalSchema = z.object({
  approvalStatus: z.enum(approvalStatuses),
  reason: z.string().trim().max(1000).nullable().optional(),
});

export const updateMemberStatusSchema = z.object({
  membershipType: z.enum(membershipTypes).optional(),
  officialMemberStatus: z.enum(officialMemberStatuses).optional(),
  reason: z.string().trim().min(1).max(1000),
  confirmation: z.string().trim().min(1).max(190),
}).refine((value) => value.membershipType || value.officialMemberStatus, {
  message: "Membership type or official status is required",
});

/** History filters shared by the table, the KPI summary and the actor options. */
const historyFilterShape = {
  search: z.string().trim().min(1).max(190).optional(),
  sourceModule: z.enum(historySources).default("All"),
  /** One exact Asia/Manila calendar date; takes precedence over `from`/`to`. */
  date: isoDateSchema.optional(),
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
  /** A user id, or `none` for events with no recorded actor. */
  actorId: z.union([z.literal("none"), z.string().regex(/^\d+$/)]).optional(),
  changeType: z.enum(historyChangeTypes).optional(),
};

export const listUnifiedStatusHistoryQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().positive().max(100).default(20),
    ...historyFilterShape,
  })
  .superRefine(refineDateRange("from", "to"));

/** Summary and actor options ignore the source filter: the cards are the per-source breakdown. */
export const unifiedStatusHistorySummaryQuerySchema = z
  .object(historyFilterShape)
  .superRefine(refineDateRange("from", "to"));
