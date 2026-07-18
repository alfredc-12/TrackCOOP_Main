import type { PaymentStatus, RentalStatus } from "../_types/rental";

export const COOPERATIVE_NAME = "Nasugbu Farmers and Fisherfolks Agriculture Cooperative";
export const PRICING_NOTICE = "Rental pricing and policies are pending final cooperative validation.";
export const POLICY_NOTICE =
  "Final rental cost, gasoline responsibility, discounts, cancellation rules, and rescheduling conditions will be confirmed by NFFAC.";
export const PENDING_POLICY_LABEL = "Pending Client Validation";

export const BARANGAYS = ["Lumbangan", "Wawa", "Bucana", "Aga", "Banilad", "Calayo", "Bilaran"];
export const EXPENSE_CATEGORIES = [
  "Gasoline",
  "Equipment Maintenance",
  "Operator Expense",
  "Transportation",
  "Repair",
  "Supplies",
  "Administrative Cost",
  "Other Rental-Related Expense",
];

export const rentalStatusTone: Record<RentalStatus, string> = {
  "New Inquiry": "bg-sky-50 text-sky-800 border-sky-200",
  "Under Review": "bg-amber-50 text-amber-800 border-amber-200",
  "Awaiting Information": "bg-orange-50 text-orange-800 border-orange-200",
  "Awaiting Confirmation": "bg-yellow-50 text-yellow-800 border-yellow-200",
  "Approved for Scheduling": "bg-teal-50 text-teal-800 border-teal-200",
  Scheduled: "bg-blue-50 text-blue-800 border-blue-200",
  "Payment Pending": "bg-amber-50 text-amber-800 border-amber-200",
  "Payment Under Review": "bg-violet-50 text-violet-800 border-violet-200",
  "Payment Confirmed": "bg-emerald-50 text-emerald-800 border-emerald-200",
  "In Progress": "bg-cyan-50 text-cyan-800 border-cyan-200",
  Completed: "bg-green-50 text-green-800 border-green-200",
  Cancelled: "bg-stone-100 text-stone-700 border-stone-200",
  Rescheduled: "bg-indigo-50 text-indigo-800 border-indigo-200",
  Rejected: "bg-red-50 text-red-800 border-red-200",
  "On Hold": "bg-slate-100 text-slate-700 border-slate-200",
};

export const paymentStatusTone: Record<PaymentStatus, string> = {
  Pending: "bg-amber-50 text-amber-800 border-amber-200",
  "Under Review": "bg-violet-50 text-violet-800 border-violet-200",
  "Partially Paid": "bg-blue-50 text-blue-800 border-blue-200",
  Paid: "bg-green-50 text-green-800 border-green-200",
  Rejected: "bg-red-50 text-red-800 border-red-200",
  Refunded: "bg-slate-100 text-slate-700 border-slate-200",
  "Needs Clarification": "bg-orange-50 text-orange-800 border-orange-200",
};
