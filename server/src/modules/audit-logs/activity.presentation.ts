import { safeText } from "./activity.safety";
export { safeText } from "./activity.safety";
import { byKey, parseStored } from "../system-settings/settings.registry";
export const activityAreas = [
  {
    id: "settings",
    label: "System Settings",
    tables: ["system_settings"],
    prefixes: ["system_setting."],
  },
  {
    id: "accounts",
    label: "Accounts & Security",
    tables: ["users", "user_sessions", "user_activation_tokens"],
    prefixes: ["user.", "auth.", "session."],
  },
  {
    id: "membership",
    label: "Membership",
    tables: [
      "membership_applications",
      "member_profiles",
      "member_referrals",
      "member_status_indicators",
      "member_activity_participation",
    ],
    prefixes: [
      "membership_application.",
      "membership.",
      "member.",
      "member_referral.",
      "member_indicators.",
    ],
  },
  {
    id: "finance",
    label: "Finance",
    tables: [
      "financial_records",
      "financial_categories",
      "payment_references",
      "member_share_capital",
      "share_capital_transactions",
      "dividend_withdrawal_requests",
    ],
    prefixes: [
      "financial_record.",
      "financial_category.",
      "operating_expense.",
      "payment_reference.",
      "share_capital.",
      "dividend.",
      "patronage.",
    ],
  },
  {
    id: "inventory",
    label: "Inventory",
    tables: ["products", "inventory_movements"],
    prefixes: ["inventory."],
  },
  {
    id: "sales",
    label: "Store & Sales",
    tables: ["pos_sales"],
    prefixes: ["pos."],
  },
  {
    id: "rentals",
    label: "Rentals",
    tables: ["rental_bookings", "rental_assets"],
    prefixes: ["rental."],
  },
  {
    id: "communications",
    label: "Messages & Announcements",
    tables: ["announcements", "inquiries"],
    prefixes: ["announcement.", "inquiry."],
  },
  {
    id: "website",
    label: "Public Website",
    tables: [
      "gallery_groups",
      "gallery_images",
      "gallery_landing_slots",
      "partners_certifications",
    ],
    prefixes: ["landing."],
  },
  {
    id: "records",
    label: "Documents & Reports",
    tables: ["documents", "generated_reports"],
    prefixes: ["document.", "report."],
  },
  { id: "other", label: "Other Activity", tables: [], prefixes: [] },
];
const explicit: Record<string, string> = {
  "system_setting.upserted": "Updated a system setting",
  "landing.gallery.created": "Created a gallery",
  "landing.gallery.updated": "Updated a gallery",
  "landing.gallery_slot.updated": "Changed a gallery placement",
  "user.password_reset": "Reset a user password",
  "user.activation_link_issued": "Issued an account activation link",
  "membership_application.approved": "Approved a membership application",
};
const subjects: Record<string, string> = {
  user: "a user account",
  auth: "account access",
  session: "a sign-in session",
  membership_application: "a membership application",
  member: "a member record",
  member_referral: "a referral",
  member_indicators: "member indicators",
  financial_record: "a financial record",
  financial_category: "a financial category",
  operating_expense: "an operating expense",
  payment_reference: "a payment reference",
  share_capital: "a share-capital record",
  dividend: "a dividend record",
  patronage: "a patronage record",
  inventory: "an inventory record",
  pos: "a store order",
  rental: "a rental record",
  announcement: "an announcement",
  inquiry: "an inquiry",
  document: "a document",
  report: "a report",
  "landing.gallery": "a gallery",
  "landing.partner": "a partner record",
  "landing.partners": "a partner or certification record",
  "landing.gallery_image": "a gallery photo",
  "rental.booking": "a rental booking",
  "rental.asset": "a rental asset",
  "landing.gallery_slot": "a gallery placement",
};
const verbs: Record<string, string> = {
  created: "Created",
  updated: "Updated",
  deleted: "Removed",
  archived: "Archived",
  restored: "Restored",
  approved: "Approved",
  rejected: "Rejected",
  posted: "Posted",
  voided: "Voided",
  reversed: "Reversed",
  validated: "Validated",
  completed: "Completed",
  released: "Released",
  cancelled: "Cancelled",
  recalculated: "Recalculated",
  published: "Published",
  uploaded: "Uploaded",
  downloaded: "Downloaded",
  exported: "Exported",
  status_changed: "Changed the status of",
  login: "Signed in to",
  logout: "Signed out of",
  password_reset: "Reset the password for",
  activated: "Activated",
  suspended: "Suspended",
  deactivated: "Deactivated",
  terminated: "Terminated",
  document_uploaded: "Uploaded a document for",
  document_removed: "Removed a document from",
  requirement_added: "Added a requirement to",
  requirement_updated: "Updated a requirement for",
  requirement_deleted: "Removed a requirement from",
  beneficiary_added: "Added a beneficiary to",
  beneficiary_updated: "Updated a beneficiary for",
  beneficiary_removed: "Removed a beneficiary from",
  roles_updated: "Updated the roles of",
  member_linked: "Linked a member profile to",
  member_unlinked: "Unlinked a member profile from",
  sessions_revoked: "Revoked sign-in sessions for",
  capital_reconciled: "Reconciled capital for",
};
export function activityLabel(action: string) {
  if (explicit[action]) return explicit[action];
  const at = action.lastIndexOf("."),
    subject = subjects[action.slice(0, at)],
    verb = verbs[action.slice(at + 1)];
  return subject && verb ? `${verb} ${subject}` : "Recorded system activity";
}
export function areaFor(action: string, table: string) {
  return (
    activityAreas.find(
      (a) =>
        a.id !== "other" &&
        (a.tables.includes(table) ||
          a.prefixes.some((p) => action.startsWith(p))),
    ) ?? activityAreas[activityAreas.length - 1]
  );
}
const safeFields: Record<string, string> = {
  recordNumber: "Record number",
  referenceNumber: "Reference",
  applicationCode: "Application code",
  memberCode: "Member code",
  status: "Status",
  accountStatus: "Account status",
  applicationStatus: "Application status",
  recordStatus: "Record status",
  validationStatus: "Validation status",
  amount: "Amount",
  recordType: "Record type",
  sourceModule: "Source",
  recordDate: "Record date",
  categoryName: "Category",
  title: "Title",
  name: "Name",
  enabled: "Enabled",
  role: "Role",
  quantity: "Quantity",
  paymentChannel: "Payment method",
  membershipType: "Membership type",
  reason: "Reason",
  notes: "Notes",
  displayName: "Display name",
  record_number: "Record number",
  reference_number: "Reference",
  application_code: "Application code",
  member_code: "Member code",
  account_status: "Account status",
  record_status: "Record status",
  application_status: "Application status",
  validation_status: "Validation status",
  record_type: "Record type",
  source_module: "Source",
  record_date: "Record date",
  category_name: "Category",
};
function object(value: unknown): Record<string, unknown> | null {
  if (typeof value === "string") {
    try {
      return object(JSON.parse(value));
    } catch {
      return null;
    }
  }
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
export function safeAuditValues(
  raw: unknown,
): Record<string, string | number | boolean | null> | null {
  const value = object(raw);
  if (!value) return null;
  if (typeof value.settingKey === "string") {
    const d = byKey.get(value.settingKey);
    if (!d) return null;
    if (!Object.prototype.hasOwnProperty.call(value, "settingValue"))
      return { Setting: d.label };
    if (value.settingValue === null) return { Setting: d.label, Value: null };
    try {
      const parsed = parseStored(
        d,
        typeof value.settingValue === "string"
          ? value.settingValue
          : JSON.stringify(value.settingValue),
        false,
      );
      const fields: Record<string, string | number | boolean | null> = {
        Setting: d.label,
      };
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const labels: Record<string, string> = {
          enabled: "Enabled",
          creditsPerSuccessfulReferral: "Credits per successful referral",
          label: "Reward label",
          activeMin: "Active minimum score",
          needsMonitoringMin: "Needs Monitoring minimum score",
          recencyDays: "Days since participation",
          frequencyCount: "Participation count",
          contributionAmount: "Capital contribution",
        };
        for (const [key, v] of Object.entries(parsed)) {
          if (Array.isArray(v))
            fields[labels[key] ?? key] = safeText(
              v
                .map((row) =>
                  typeof row === "object" && row
                    ? Object.entries(row)
                        .map(([k, n]) => `${k}: ${n}`)
                        .join(", ")
                    : String(row),
                )
                .join("; "),
              3000,
            );
          else if (typeof v === "string")
            fields[labels[key] ?? key] = safeText(v, 500);
          else if (
            typeof v === "number" ||
            typeof v === "boolean" ||
            v === null
          )
            fields[labels[key] ?? key] = v;
        }
      } else
        fields.Value = Array.isArray(parsed)
          ? safeText(parsed.join(", "), 1000)
          : typeof parsed === "string"
            ? safeText(parsed)
            : (parsed as number | boolean | null);
      return fields;
    } catch {
      return { Setting: d.label, Value: "Recorded value withheld or invalid" };
    }
  }
  const result: Record<string, string | number | boolean | null> = {};
  for (const [key, label] of Object.entries(safeFields)) {
    const v = value[key];
    if (typeof v === "string") result[label] = safeText(v, 500);
    else if (typeof v === "boolean" || v === null) result[label] = v;
    else if (typeof v === "number" && Number.isFinite(v)) result[label] = v;
  }
  return Object.keys(result).length ? result : null;
}
export function safeActionCode(value: string) {
  return safeText(value, 100) === value &&
    /^[a-z_][a-z0-9_.-]{0,99}$/i.test(value)
    ? value
    : "unrecognized_activity";
}

export function matchingActions(text: string) {
  const needle = text.toLowerCase();
  const candidates = [
    ...Object.keys(explicit),
    ...Object.keys(subjects).flatMap((subject) =>
      Object.keys(verbs).map((verb) => `${subject}.${verb}`),
    ),
  ];
  return [...new Set(candidates)]
    .filter((action) => activityLabel(action).toLowerCase().includes(needle))
    .slice(0, 200);
}
