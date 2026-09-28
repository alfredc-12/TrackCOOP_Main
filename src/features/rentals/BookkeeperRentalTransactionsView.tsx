"use client";

import {
  BadgeCheck,
  Banknote,
  CalendarDays,
  ChevronDown,
  Eye,
  RefreshCcw,
  Search,
  Tractor,
  WalletCards,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/portal/PageHeader";
import {
  CurrencyDisplay,
  DataTable,
  EmptyState,
  ErrorState,
  FormDialog,
  LoadingSkeleton,
  StatCard,
  StatusBadge,
} from "@/components/portal/PortalPrimitives";
import { ApiClientError } from "@/lib/api-client";
import {
  getPaymentReferenceDetail,
  getPaymongoPaymentStatus,
  listPaymentReferences,
  paymentReferenceProofUrl,
  rejectPaymentReference,
  requestPaymentClarification,
  validatePaymentReference,
  type PaymentReferenceDetail,
  type PaymentReferenceListItem,
} from "@/features/finance/finance-api";

type Decision = "approve" | "correction" | "reject" | null;

function statusLabel(status: string) {
  if (status === "Validated") return "Approved";
  if (status === "Needs Clarification") return "Needs correction";
  return status;
}

function statusTone(status: string) {
  if (status === "Validated") return "success" as const;
  if (status === "Pending" || status === "Needs Clarification") return "warning" as const;
  if (status === "Rejected" || status === "Reversed") return "danger" as const;
  return "neutral" as const;
}

function dateOnly(value: string | null) {
  if (!value) return "Not recorded";
  const parsed = new Date(value);
  const currentYear = new Date().getFullYear();
  if (Number.isNaN(parsed.getTime()) || parsed.getFullYear() < 2000 || parsed.getFullYear() > currentYear + 5) return "Invalid date";
  return new Intl.DateTimeFormat("en-PH", { dateStyle: "medium" }).format(parsed);
}

function RentalStatusSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const options = [{ value: "", label: "All statuses" }, { value: "Pending", label: "Waiting" }, { value: "Needs Clarification", label: "Needs correction" }, { value: "Validated", label: "Approved" }, { value: "Rejected", label: "Rejected" }, { value: "Reversed", label: "Reversed" }];
  const selected = options.find((option) => option.value === value)?.label ?? "All statuses";
  return <div className="relative"><button type="button" aria-label="Filter payment status" aria-expanded={open} onClick={() => setOpen((current) => !current)} className="flex h-11 w-full items-center justify-between gap-3 rounded-md border border-[#CAD8CB] bg-white px-3 text-left text-sm font-bold text-[#123D2A] outline-none focus:border-[#1F6B43] focus:ring-4 focus:ring-[#82E6A7]/20"><span>{selected}</span><ChevronDown className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} /></button>{open ? <div role="listbox" className="absolute z-30 mt-2 w-full rounded-md border border-[#CAD8CB] bg-white p-1 shadow-[0_12px_28px_rgba(18,61,42,0.16)]">{options.map((option) => <button key={option.value} type="button" role="option" aria-selected={option.value === value} onClick={() => { onChange(option.value); setOpen(false); }} className={`w-full rounded px-3 py-3 text-left text-sm ${option.value === value ? "bg-[#EAF5EC] font-bold text-[#123D2A]" : "text-[#294B39] hover:bg-[#F2FAF3]"}`}>{option.label}</button>)}</div> : null}</div>;
}

function RentalPageSizeSelect({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const [open, setOpen] = useState(false);
  const options = [5, 10, 20, 50];
  return <div className="relative w-32"><button type="button" aria-label="Rows per page" aria-expanded={open} onClick={() => setOpen((current) => !current)} className="flex h-10 w-full items-center justify-between gap-2 rounded-md border border-[#CAD8CB] bg-white px-3 text-left text-sm font-bold text-[#123D2A] outline-none focus:border-[#1F6B43] focus:ring-4 focus:ring-[#82E6A7]/20"><span>{value} per page</span><ChevronDown className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} /></button>{open ? <div className="absolute bottom-full z-30 mb-2 w-full rounded-md border border-[#CAD8CB] bg-white p-1 shadow-[0_12px_28px_rgba(18,61,42,0.16)]">{options.map((option) => <button key={option} type="button" onClick={() => { onChange(option); setOpen(false); }} className={`w-full rounded px-3 py-2 text-left text-sm ${option === value ? "bg-[#EAF5EC] font-bold text-[#123D2A]" : "text-[#294B39] hover:bg-[#F2FAF3]"}`}>{option} per page</button>)}</div> : null}</div>;
}

function rentalPeriod(payment: Pick<PaymentReferenceListItem, "rentalStartAt" | "rentalEndAt">) {
  const start = dateOnly(payment.rentalStartAt);
  const end = dateOnly(payment.rentalEndAt);
  return start === end ? start : `${start} to ${end}`;
}

function rentalQuantity(payment: Pick<PaymentReferenceListItem, "rentalQuantity" | "rentalUnit">) {
  if (!payment.rentalQuantity) return "1 rental";
  return [payment.rentalQuantity, payment.rentalUnit].filter(Boolean).join(" ");
}

function paymentMethod(payment: Pick<PaymentReferenceListItem, "paymentChannel" | "gatewayPaymentMethod">) {
  if (payment.paymentChannel === "PayMongo") {
    return payment.gatewayPaymentMethod ? `PayMongo - ${payment.gatewayPaymentMethod}` : "PayMongo";
  }
  return payment.paymentChannel;
}

function Info({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return <div className="rounded-lg border border-[#CAD8CB] bg-white p-4">
    <p className="text-xs font-black uppercase tracking-[0.14em] text-[#6C7A70]">{label}</p>
    <p className="mt-2 break-words font-bold text-[#123D2A]">{value}</p>
    {sub ? <p className="mt-1 text-xs leading-5 text-[#5D6D63]">{sub}</p> : null}
  </div>;
}

export function BookkeeperRentalTransactionsView() {
  const [payments, setPayments] = useState<PaymentReferenceListItem[]>([]);
  const [selected, setSelected] = useState<PaymentReferenceDetail | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [decision, setDecision] = useState<Decision>(null);
  const [cashReceived, setCashReceived] = useState(false);
  const [detailsMatch, setDetailsMatch] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [modalError, setModalError] = useState("");
  const refreshInFlight = useRef(false);

  const load = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (refreshInFlight.current) return;
    refreshInFlight.current = true;
    if (!silent) {
      setLoading(true);
      setError("");
    }
    try {
      const result = await listPaymentReferences({
        paymentPurpose: "Rental",
        page: 1,
        pageSize: 100,
        sortBy: "submittedAt",
        sortDirection: "desc",
      });
      setPayments(result.items);
      setError("");
    } catch (loadError) {
      if (!silent) setError(loadError instanceof Error ? loadError.message : "Rental payments could not be loaded.");
    } finally {
      refreshInFlight.current = false;
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => void load(), 0);
    const refreshTimer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load({ silent: true });
    }, 15_000);
    return () => { window.clearTimeout(timeout); window.clearInterval(refreshTimer); };
  }, [load]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return payments.filter((payment) => {
      const matchesStatus = !status || payment.validationStatus === status;
      const haystack = [payment.payerName, payment.rentalNumber, payment.rentalEquipmentName, payment.referenceNumber]
        .filter(Boolean).join(" ").toLowerCase();
      return matchesStatus && (!term || haystack.includes(term));
    });
  }, [payments, search, status]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visiblePayments = filtered.slice((page - 1) * pageSize, page * pageSize);

  const totals = useMemo(() => ({
    waiting: payments.filter((item) => ["Pending", "Needs Clarification"].includes(item.validationStatus)).length,
    online: payments.filter((item) => item.paymentChannel === "PayMongo").length,
    cash: payments.filter((item) => item.paymentChannel === "Cash").length,
    approved: payments.filter((item) => item.validationStatus === "Validated").length,
  }), [payments]);

  async function openPayment(id: string) {
    setDetailLoading(true);
    setModalError("");
    setDecision(null);
    try {
      setSelected(await getPaymentReferenceDetail(id));
    } catch (detailError) {
      const message = detailError instanceof Error ? detailError.message : "Payment details could not be loaded.";
      setModalError(message);
      toast.error(message);
    } finally {
      setDetailLoading(false);
    }
  }

  async function refreshSelected() {
    if (!selected) return;
    const detail = await getPaymentReferenceDetail(selected.id);
    setSelected(detail);
    await load();
  }

  async function checkPayMongo() {
    if (!selected) return;
    setSaving(true);
    try {
      const result = await getPaymongoPaymentStatus(selected.id);
      await refreshSelected();
      toast.success(result.validationStatus === "Validated"
        ? "PayMongo confirmed this rental payment."
        : "PayMongo has not confirmed this payment yet.");
    } catch (checkError) {
      const message = checkError instanceof Error ? checkError.message : "PayMongo status could not be checked.";
      setModalError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  async function submitDecision() {
    if (!selected || !decision) return;
    if (decision === "approve" && (!cashReceived || !detailsMatch)) return;
    if (decision !== "approve" && reason.trim().length < 8) return;
    setSaving(true);
    try {
      if (decision === "approve") await validatePaymentReference(selected.id);
      if (decision === "correction") await requestPaymentClarification(selected.id, reason.trim());
      if (decision === "reject") await rejectPaymentReference(selected.id, reason.trim());
      toast.success(decision === "approve" ? "Cash payment approved." : "Rental payment status updated.");
      setDecision(null);
      setCashReceived(false);
      setDetailsMatch(false);
      setReason("");
      await refreshSelected();
    } catch (saveError) {
      const message = saveError instanceof ApiClientError ? saveError.message : "The payment decision could not be saved.";
      setModalError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  const canReview = selected && !["Validated", "Reversed"].includes(selected.validationStatus);
  const isOnline = selected?.paymentChannel === "PayMongo";

  return <div className="grid gap-7">
    <PageHeader eyebrow="Operations" title="Rental Transactions"
      description="Check who rented, what they rented, the amount paid, and approve the payment."
      actions={<StatusBadge tone="success">Bookkeeper</StatusBadge>} />

    <div className="rounded-lg border border-[#B7D7BD] bg-[#F2FAF3] p-4 text-sm leading-6 text-[#294B39]">
      <strong>Simple rule:</strong> PayMongo confirms online payments. For cash, you check that the money was received and decide whether to approve it.
    </div>

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard label="Waiting for review" value={String(totals.waiting)} icon={CalendarDays} />
      <StatCard label="Online / PayMongo" value={String(totals.online)} icon={WalletCards} />
      <StatCard label="Cash payments" value={String(totals.cash)} icon={Banknote} />
      <StatCard label="Approved" value={String(totals.approved)} icon={BadgeCheck} />
    </div>

    <div className="grid gap-3 rounded-lg border border-[#CAD8CB] bg-white p-4 md:grid-cols-[minmax(0,1fr)_13rem_8rem_auto]">
      <label className="relative"><span className="sr-only">Search rentals</span><Search className="absolute left-3 top-3.5 size-4 text-[#6C7A70]" />
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search renter, equipment, or reference"
          className="h-11 w-full rounded-md border border-[#CAD8CB] bg-[#F7F8F3] pl-10 pr-3 text-sm outline-none focus:border-[#1F6B43]" />
      </label>
      <RentalStatusSelect value={status} onChange={(value) => { setStatus(value); setPage(1); }} />
      <RentalPageSizeSelect value={pageSize} onChange={(value) => { setPageSize(value); setPage(1); }} />
      <button type="button" disabled={loading} aria-busy={loading} onClick={() => void load()} className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-[#CAD8CB] px-4 text-sm font-bold text-[#123D2A] disabled:opacity-60">
        <RefreshCcw className={`size-4 ${loading ? "animate-spin" : ""}`} />{loading ? "Loading..." : "Refresh"}
      </button>
    </div>

    {error ? <ErrorState message={error} onRetry={() => void load()} /> : loading ? <LoadingSkeleton /> : filtered.length === 0
      ? <EmptyState icon={Tractor} title="No rental payments found" description="Rental payments will appear here after they are recorded." />
      : <><DataTable><table className="min-w-full divide-y divide-[#E2E8E2] text-left text-sm">
        <thead className="bg-[#F7F8F3] text-xs uppercase tracking-[0.14em] text-[#5D6D63]"><tr>
          <th className="px-5 py-4">Renter</th><th className="px-5 py-4">Equipment / period</th><th className="px-5 py-4 text-center">Quantity</th>
          <th className="px-5 py-4 text-center">Amount</th><th className="px-5 py-4 text-center">Payment method</th><th className="px-5 py-4 text-center">Status</th><th className="px-5 py-4"><span className="sr-only">Action</span></th>
        </tr></thead>
        <tbody className="divide-y divide-[#EEF2EC]">{visiblePayments.map((payment) => <tr key={payment.id} className="hover:bg-[#F7F8F3]">
          <td className="px-5 py-4"><p className="font-bold text-[#123D2A]">{payment.payerName || "Not recorded"}</p><p className="mt-1 text-xs text-[#6C7A70]">{payment.rentalNumber || payment.referenceNumber}</p></td>
          <td className="px-5 py-4"><p className="font-bold text-[#123D2A]">{payment.rentalEquipmentName || "Rental equipment"}</p><p className="mt-1 text-xs text-[#6C7A70]">{rentalPeriod(payment)}</p></td>
          <td className="px-5 py-4 text-center font-semibold text-[#294B39]">{rentalQuantity(payment)}</td>
          <td className="px-5 py-4 text-center"><CurrencyDisplay value={payment.amount} /></td>
          <td className="px-5 py-4 text-center"><StatusBadge tone={payment.paymentChannel === "PayMongo" ? "success" : "neutral"}>{paymentMethod(payment)}</StatusBadge></td>
          <td className="px-5 py-4 text-center"><StatusBadge tone={statusTone(payment.validationStatus)}>{statusLabel(payment.validationStatus)}</StatusBadge></td>
          <td className="px-5 py-4"><button type="button" onClick={() => void openPayment(payment.id)} className="inline-flex h-10 items-center gap-2 rounded-md bg-[#123D2A] px-4 font-bold text-white"><Eye className="size-4" />Review</button></td>
        </tr>)}</tbody>
      </table></DataTable><div className="flex flex-col items-center justify-between gap-3 text-center text-sm sm:flex-row sm:text-left"><span className="font-semibold text-[#6C7A70]">Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)} of {filtered.length} rentals</span><div className="flex items-center gap-2"><button type="button" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="rounded-md border border-[#CAD8CB] px-3 py-2 font-bold disabled:opacity-40">Previous</button><button type="button" disabled={page >= pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))} className="rounded-md border border-[#CAD8CB] px-3 py-2 font-bold disabled:opacity-40">Next</button></div></div></>}

    <FormDialog open={detailLoading || Boolean(selected)} onOpenChange={(open) => { if (!open && !saving) { setSelected(null); setDecision(null); } }}
      title={selected?.rentalNumber || "Rental payment"} description={selected?.rentalEquipmentName || "Loading rental details…"}
      contentClassName="w-[min(68rem,calc(100vw-2rem))]">
      {detailLoading || !selected ? <div aria-busy="true" aria-live="polite"><LoadingSkeleton /></div> : <div className="grid gap-5 pt-3">
        {modalError ? <div role="alert" aria-live="assertive" className="rounded-md border border-[#D9A99F] bg-[#FFF4F1] p-3 text-sm font-semibold text-[#7A3023]">{modalError}</div> : null}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Info label="Renter" value={selected.payerName || "Not recorded"} sub={selected.payerContact || undefined} />
          <Info label="Rented" value={selected.rentalEquipmentName || "Rental equipment"} sub={rentalPeriod(selected)} />
          <Info label="Qty / Use" value={rentalQuantity(selected)} />
          <Info label="Amount paid" value={new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(selected.amount)} />
          <Info label="Paid through" value={paymentMethod(selected)} sub={selected.referenceNumber} />
          <Info label="Status" value={statusLabel(selected.validationStatus)} sub={selected.rejectionReason || undefined} />
        </div>

        {selected.proofFilePath ? <a href={paymentReferenceProofUrl(selected.id)} target="_blank" rel="noreferrer"
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border-2 border-[#1F6B43] bg-white px-5 font-bold text-[#123D2A]"><Eye className="size-5" />Open payment proof</a> : null}

        {canReview ? <section className="rounded-lg border-2 border-[#B7D7BD] bg-[#F2FAF3] p-5">
          {isOnline ? <div className="grid gap-4">
            <div><h2 className="text-lg font-black text-[#123D2A]">Online payment</h2><p className="mt-1 text-sm text-[#5D6D63]">TrackCOOP will approve this only after PayMongo confirms it. You cannot manually approve an online payment.</p></div>
            <button type="button" disabled={saving} onClick={() => void checkPayMongo()} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-[#123D2A] px-5 font-bold text-white disabled:opacity-50"><RefreshCcw className={`size-5 ${saving ? "animate-spin" : ""}`} />{saving ? "Checking PayMongo..." : "Check PayMongo status"}</button>
          </div> : <div className="grid gap-4">
            <div><h2 className="text-lg font-black text-[#123D2A]">Cash or manual payment</h2><p className="mt-1 text-sm text-[#5D6D63]">You decide after checking the cash and rental details.</p></div>
            {!decision ? <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setDecision("approve")} className="inline-flex min-h-11 items-center gap-2 rounded-md bg-[#123D2A] px-5 font-bold text-white"><BadgeCheck className="size-5" />Approve cash payment</button>
              <button type="button" onClick={() => setDecision("correction")} className="min-h-11 rounded-md border border-[#1F6B43] bg-white px-4 font-bold text-[#123D2A]">Ask for correction</button>
              <button type="button" onClick={() => setDecision("reject")} className="inline-flex min-h-11 items-center gap-2 rounded-md border border-[#D9A99F] bg-white px-4 font-bold text-[#7A3023]"><X className="size-4" />Reject</button>
            </div> : <div className="grid gap-4 rounded-lg border border-[#CAD8CB] bg-white p-4">
              <h3 className="font-black text-[#123D2A]">{decision === "approve" ? "Confirm cash payment" : decision === "correction" ? "Ask for correction" : "Reject payment"}</h3>
              {decision === "approve" ? <div className="grid gap-3">
                <label className="flex items-start gap-3 text-sm font-semibold text-[#294B39]"><input type="checkbox" checked={cashReceived} onChange={(event) => setCashReceived(event.target.checked)} className="mt-0.5 size-5 accent-[#1F6B43]" />I received the cash or checked the cash record.</label>
                <label className="flex items-start gap-3 text-sm font-semibold text-[#294B39]"><input type="checkbox" checked={detailsMatch} onChange={(event) => setDetailsMatch(event.target.checked)} className="mt-0.5 size-5 accent-[#1F6B43]" />The renter, equipment, dates, and amount are correct.</label>
              </div> : <label className="grid gap-2 text-sm font-bold text-[#294B39]">Reason<textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} placeholder="Write a short, clear reason" className="rounded-md border border-[#CAD8CB] p-3 font-normal" /></label>}
              <div className="flex justify-end gap-2"><button type="button" disabled={saving} onClick={() => setDecision(null)} className="min-h-11 rounded-md border border-[#CAD8CB] px-4 font-bold">Cancel</button>
                <button type="button" disabled={saving || (decision === "approve" ? !cashReceived || !detailsMatch : reason.trim().length < 8)} onClick={() => void submitDecision()} className="min-h-11 rounded-md bg-[#123D2A] px-5 font-bold text-white disabled:bg-[#CAD8CB]">{saving ? "Saving…" : "Confirm"}</button></div>
            </div>}
          </div>}
        </section> : <div className="rounded-lg border border-[#CAD8CB] bg-[#F7F8F3] p-4 text-sm font-semibold text-[#5D6D63]">This payment is already {statusLabel(selected.validationStatus).toLowerCase()}.</div>}
      </div>}
    </FormDialog>
  </div>;
}
