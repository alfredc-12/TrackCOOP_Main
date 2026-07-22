import { z } from "zod";

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

export const listMembersQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().trim().min(1).max(190).optional(),
  approvalStatus: z.enum(approvalStatuses).optional(),
  officialMemberStatus: z.enum(officialMemberStatuses).optional(),
  membershipType: z.enum(membershipTypes).optional(),
  barangay: z.string().trim().min(1).max(120).optional(),
  sortBy: z
    .enum(["fullName", "memberCode", "createdAt", "applicationDate"])
    .default("createdAt"),
  sortDirection: z.enum(["asc", "desc"]).default("desc"),
});

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
}).refine((value) => value.membershipType || value.officialMemberStatus, {
  message: "Membership type or official status is required",
});
