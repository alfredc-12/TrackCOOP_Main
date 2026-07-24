import type {
  RentalStatus,
  ScheduleStatus,
} from "../_types/rental";

export const RENTAL_STATUS_TRANSITIONS: Record<RentalStatus, readonly RentalStatus[]> = {
  "New Inquiry": [
    "Under Review",
    "Awaiting Information",
    "Approved for Scheduling",
    "On Hold",
    "Rejected",
    "Cancelled",
  ],
  "Under Review": [
    "Awaiting Information",
    "Awaiting Confirmation",
    "Approved for Scheduling",
    "On Hold",
    "Rejected",
    "Cancelled",
  ],
  "Awaiting Information": ["Under Review", "Cancelled", "Rejected"],
  "Awaiting Confirmation": [
    "Approved for Scheduling",
    "Scheduled",
    "Rescheduled",
    "Cancelled",
    "Rejected",
  ],
  "Approved for Scheduling": [
    "Awaiting Confirmation",
    "Scheduled",
    "On Hold",
    "Cancelled",
  ],
  Scheduled: [
    "Payment Pending",
    "Payment Under Review",
    "Payment Confirmed",
    "In Progress",
    "Rescheduled",
    "Cancelled",
  ],
  "Payment Pending": [
    "Payment Under Review",
    "Payment Confirmed",
    "In Progress",
    "Rescheduled",
    "Cancelled",
  ],
  "Payment Under Review": [
    "Payment Pending",
    "Payment Confirmed",
    "Rescheduled",
    "Cancelled",
  ],
  "Payment Confirmed": ["In Progress", "Rescheduled", "Cancelled"],
  "In Progress": ["Completed", "Cancelled"],
  Completed: [],
  Cancelled: [],
  Rescheduled: [
    "Awaiting Confirmation",
    "Scheduled",
    "Payment Pending",
    "Payment Confirmed",
    "Cancelled",
  ],
  Rejected: [],
  "On Hold": ["Under Review", "Approved for Scheduling", "Cancelled", "Rejected"],
};

export type ChairmanRentalActionId =
  | "start-review"
  | "approve-scheduling"
  | "request-information"
  | "place-hold"
  | "reject-inquiry"
  | "propose-schedule"
  | "confirm-schedule"
  | "approve-rescheduling"
  | "cancel-booking"
  | "mark-in-progress"
  | "mark-completed";

export type ChairmanRentalAction = {
  id: ChairmanRentalActionId;
  label: string;
  description: string;
  kind: "status" | "schedule";
  targetStatus?: RentalStatus;
  scheduleStatus?: Extract<ScheduleStatus, "Awaiting Confirmation" | "Confirmed">;
  tone: "primary" | "secondary" | "danger";
  allowedFrom?: readonly RentalStatus[];
};

const CHAIRMAN_RENTAL_ACTIONS: readonly ChairmanRentalAction[] = [
  {
    id: "start-review",
    label: "Start Review",
    description: "Assign this inquiry to the Chairman review queue.",
    kind: "status",
    targetStatus: "Under Review",
    tone: "secondary",
    allowedFrom: ["New Inquiry", "Awaiting Information", "On Hold"],
  },
  {
    id: "approve-scheduling",
    label: "Approve for Scheduling",
    description: "Approve the inquiry so a conflict-checked schedule can be proposed.",
    kind: "status",
    targetStatus: "Approved for Scheduling",
    tone: "primary",
    allowedFrom: ["New Inquiry", "Under Review", "On Hold"],
  },
  {
    id: "request-information",
    label: "Request More Information",
    description: "Ask the requester for missing or unclear information.",
    kind: "status",
    targetStatus: "Awaiting Information",
    tone: "secondary",
    allowedFrom: ["New Inquiry", "Under Review"],
  },
  {
    id: "place-hold",
    label: "Place on Hold",
    description: "Pause the inquiry while an internal concern is resolved.",
    kind: "status",
    targetStatus: "On Hold",
    tone: "secondary",
    allowedFrom: ["New Inquiry", "Under Review", "Approved for Scheduling"],
  },
  {
    id: "reject-inquiry",
    label: "Reject Inquiry",
    description: "Close the inquiry as rejected and explain the decision.",
    kind: "status",
    targetStatus: "Rejected",
    tone: "danger",
    allowedFrom: [
      "New Inquiry",
      "Under Review",
      "Awaiting Information",
      "Awaiting Confirmation",
      "On Hold",
    ],
  },
  {
    id: "propose-schedule",
    label: "Propose Schedule",
    description: "Offer an available date and time for requester confirmation.",
    kind: "schedule",
    scheduleStatus: "Awaiting Confirmation",
    tone: "primary",
  },
  {
    id: "confirm-schedule",
    label: "Confirm Schedule",
    description: "Finalize the selected date, time, asset, and assigned operator.",
    kind: "schedule",
    scheduleStatus: "Confirmed",
    tone: "primary",
  },
  {
    id: "approve-rescheduling",
    label: "Approve Rescheduling",
    description: "Conflict-check and approve the requester’s proposed replacement date.",
    kind: "schedule",
    scheduleStatus: "Confirmed",
    tone: "primary",
  },
  {
    id: "cancel-booking",
    label: "Cancel Booking",
    description: "Cancel an active inquiry or booking and record the reason.",
    kind: "status",
    targetStatus: "Cancelled",
    tone: "danger",
    allowedFrom: [
      "New Inquiry",
      "Under Review",
      "Awaiting Information",
      "Awaiting Confirmation",
      "Approved for Scheduling",
      "Scheduled",
      "Payment Pending",
      "Payment Under Review",
      "Payment Confirmed",
      "In Progress",
      "Rescheduled",
      "On Hold",
    ],
  },
  {
    id: "mark-in-progress",
    label: "Mark In Progress",
    description: "Record that the approved rental operation has started.",
    kind: "status",
    targetStatus: "In Progress",
    tone: "primary",
    allowedFrom: ["Scheduled", "Payment Pending", "Payment Confirmed"],
  },
  {
    id: "mark-completed",
    label: "Mark Completed",
    description: "Close the rental operation and record its completion note.",
    kind: "status",
    targetStatus: "Completed",
    tone: "primary",
    allowedFrom: ["In Progress"],
  },
];

export function canTransitionRentalStatus(
  current: RentalStatus,
  next: RentalStatus,
) {
  return current === next || RENTAL_STATUS_TRANSITIONS[current].includes(next);
}

export function assertRentalStatusTransition(
  current: RentalStatus,
  next: RentalStatus,
) {
  if (!canTransitionRentalStatus(current, next)) {
    throw new Error(`Rental status cannot change from ${current} to ${next}.`);
  }
}

export function getChairmanRentalActions(
  current: RentalStatus,
  scheduleStatus?: ScheduleStatus,
) {
  return CHAIRMAN_RENTAL_ACTIONS.filter((action) => {
    if (action.kind === "status" && action.targetStatus) {
      return (
        (!action.allowedFrom || action.allowedFrom.includes(current)) &&
        action.targetStatus !== current &&
        canTransitionRentalStatus(current, action.targetStatus)
      );
    }
    if (action.id === "propose-schedule") {
      return (
        ["Approved for Scheduling", "Awaiting Confirmation"].includes(current) &&
        scheduleStatus !== "Confirmed"
      );
    }
    if (action.id === "confirm-schedule") {
      return (
        current !== "Rescheduled" &&
        Boolean(scheduleStatus) &&
        ["Proposed", "Awaiting Confirmation"].includes(scheduleStatus ?? "") &&
        canTransitionRentalStatus(current, "Scheduled")
      );
    }
    if (action.id === "approve-rescheduling") {
      return current === "Rescheduled";
    }
    return false;
  });
}
