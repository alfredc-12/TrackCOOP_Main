"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Banknote, CheckCircle, Printer, Search, ShoppingBag, Smartphone, XCircle, AlertCircle, X, Eye, ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, RotateCcw, Loader2, RefreshCw, CalendarDays, CircleDollarSign } from "lucide-react";
import { toast } from "sonner";

type PosOrderItem = {
  name: string;
  quantity: number;
  price: number | string;
};

type PosOrder = {
  id: number;
  sale_number: string;
  sale_date: string;
  sale_status: string;
  payment_status?: string;
  subtotal_amount?: number | string;
  discount_amount?: number | string;
  total_amount: number | string;
  customer_name?: string | null;
  customer_email?: string | null;
  customer_contact?: string | null;
  payment_reference_id?: number | string | null;
  provider?: string | null;
  reference_number?: string | null;
  items?: PosOrderItem[];
};

function PosThemedSelect({ value, onChange, options, ariaLabel }: { value: string; onChange: (value: string) => void; options: { value: string; label: string }[]; ariaLabel: string }) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value)?.label ?? value;
  return <div className="relative">
    <button type="button" onClick={() => setOpen((current) => !current)} aria-haspopup="listbox" aria-expanded={open} aria-label={ariaLabel} className="flex min-w-[150px] items-center justify-between gap-4 rounded-xl border border-[#BBD7C1] bg-[#F8FBF8] px-4 py-3 text-left text-sm font-semibold text-[#123D2A] outline-none transition hover:border-[#1F6B43] focus:ring-2 focus:ring-[#1F6B43]/20"><span>{selected}</span><ChevronDown className={`size-4 text-[#52705D] transition ${open ? "rotate-180" : ""}`} /></button>
    {open && <div role="listbox" className="absolute left-0 top-full z-[80] mt-2 min-w-full overflow-hidden rounded-xl border border-[#CDE2D1] bg-white p-1.5 shadow-[0_12px_28px_rgba(18,61,42,0.16)]">{options.map((option) => <button type="button" role="option" aria-selected={value === option.value} key={option.value} onClick={() => { onChange(option.value); setOpen(false); }} className={`flex w-full items-center justify-between whitespace-nowrap rounded-lg px-3 py-2.5 text-left text-sm transition ${value === option.value ? "bg-[#EAF5EC] font-bold text-[#123D2A]" : "text-[#52705D] hover:bg-[#F5F8F3] hover:text-[#123D2A]"}`}>{option.label}{value === option.value && <span className="text-lg text-[#1F6B43]">✓</span>}</button>)}</div>}
  </div>;
}

function formatMoney(value: number | string) {
  return `₱ ${Number(value).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
}

export default function PosSalesClient() {
  const [orders, setOrders] = useState<PosOrder[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [dateFilter, setDateFilter] = useState("All time");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Modal States
  const [orderToConfirmId, setOrderToConfirmId] = useState<number | null>(null);
  const [confirmDiscountAmount, setConfirmDiscountAmount] = useState<string>("");
  const [confirmDiscountError, setConfirmDiscountError] = useState<string>("");
  const [isConfirming, setIsConfirming] = useState(false);
  const [orderToRejectId, setOrderToRejectId] = useState<number | null>(null);
  const [orderToRevokeId, setOrderToRevokeId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [revokeReason, setRevokeReason] = useState("");
  const [isRevoking, setIsRevoking] = useState(false);
  const [receiptOrder, setReceiptOrder] = useState<PosOrder | null>(null);
  const [detailsOrder, setDetailsOrder] = useState<PosOrder | null>(null);

  const fetchOrders = useCallback(async () => {
    try {
      const response = await fetch("/api/pos/orders", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Unable to load POS sales.");
      }

      setOrders((await response.json()) as PosOrder[]);
      setLoadError("");
      setLastUpdated(new Date());
    } catch (error) {
      console.error("Failed to fetch POS orders", error);
      setLoadError("POS sales could not be loaded. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshOrders = async () => {
    setIsRefreshing(true);
    await fetchOrders();
    setIsRefreshing(false);
  };

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchOrders();
    }, 0);

    const intervalId = window.setInterval(() => {
      void fetchOrders();
    }, 5000);

    return () => {
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
    };
  }, [fetchOrders]);

  useEffect(() => {
    if (orderToConfirmId !== null || orderToRejectId !== null || orderToRevokeId !== null || receiptOrder !== null || detailsOrder !== null) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    return () => { document.body.style.overflow = 'auto'; };
  }, [orderToConfirmId, orderToRejectId, orderToRevokeId, receiptOrder, detailsOrder]);

  const filteredOrders = useMemo(() => {
    const query = searchQuery.toLowerCase();
    const now = new Date();

    return orders.filter((order) => {
      const matchesStatus = statusFilter === "All" || order.sale_status === statusFilter;
      const saleDate = new Date(order.sale_date);
      const matchesDate = dateFilter === "All time"
        || (dateFilter === "Today" && saleDate.toDateString() === now.toDateString())
        || (dateFilter === "This week" && now.getTime() - saleDate.getTime() <= 7 * 24 * 60 * 60 * 1000)
        || (dateFilter === "This month" && saleDate.getMonth() === now.getMonth() && saleDate.getFullYear() === now.getFullYear());
      const matchesSearch =
        order.sale_number.toLowerCase().includes(query) ||
        (order.customer_name ?? "").toLowerCase().includes(query) ||
        (order.customer_contact ?? "").toLowerCase().includes(query);

      return matchesStatus && matchesDate && matchesSearch;
    });
  }, [orders, searchQuery, statusFilter, dateFilter]);

  const paginatedOrders = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredOrders.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredOrders, currentPage]);

  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);

  const pendingCount = orders.filter((order) => order.sale_status === "Pending Payment").length;
  const paidCount = orders.filter((order) => order.sale_status === "Paid").length;
  const totalSales = orders
    .filter((order) => order.sale_status === "Paid")
    .reduce((sum, order) => sum + Number(order.total_amount), 0);
  const cashSales = orders.filter((order) => order.sale_status === "Paid" && !order.payment_reference_id).reduce((sum, order) => sum + Number(order.total_amount), 0);
  const gcashSales = orders.filter((order) => order.sale_status === "Paid" && order.payment_reference_id).reduce((sum, order) => sum + Number(order.total_amount), 0);

  const confirmPayment = (orderId: number) => {
    setOrderToConfirmId(orderId);
    setConfirmDiscountAmount("");
    setConfirmDiscountError("");
  };

  const processConfirmPayment = async () => {
    if (orderToConfirmId === null) return;
    if (isConfirming) return;
    
    if (Number(confirmDiscountAmount) > 100) {
      setConfirmDiscountError("Discount cannot exceed 100%");
      return;
    }

    setIsConfirming(true);
    try {
      const confirmedOrder = orders.find(o => o.id === orderToConfirmId);
      const subtotal = Number(confirmedOrder?.subtotal_amount || confirmedOrder?.total_amount || 0);
      const memberDiscountAmount = Number(confirmedOrder?.discount_amount || 0);
      
      const additionalDiscountPercent = confirmDiscountAmount ? Number(confirmDiscountAmount) : 0;
      const additionalDiscountAmount = subtotal * (additionalDiscountPercent / 100);
      
      const totalDiscountAmount = memberDiscountAmount + additionalDiscountAmount;

      const response = await fetch(`/api/pos/orders/${orderToConfirmId}/confirm`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ discount_amount: totalDiscountAmount }),
      });
      
      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: "Order confirmation failed." }));
        toast.error(payload.error ?? "Order confirmation failed.");
        return;
      }

      toast.success("Payment confirmed!");
      if (confirmedOrder) {
        const newTotal = Math.max(0, subtotal - totalDiscountAmount);
        setReceiptOrder({
          ...confirmedOrder,
          sale_status: "Paid",
          payment_status: "Paid",
          discount_amount: totalDiscountAmount,
          total_amount: newTotal,
          subtotal_amount: subtotal,
        });
      }
      setOrderToConfirmId(null);
      await fetchOrders();
    } catch (error) {
      console.error("Failed to confirm order", error);
      toast.error("Order confirmation failed.");
    } finally {
      setIsConfirming(false);
    }
  };

  const processRejectPayment = async () => {
    if (orderToRejectId === null) return;
    try {
      const response = await fetch(`/api/pos/orders/${orderToRejectId}/reject`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectReason })
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: "Order rejection failed." }));
        toast.error(payload.error ?? "Order rejection failed.");
        return;
      }

      toast.success("Order rejected.");
      setOrderToRejectId(null);
      setRejectReason("");
      await fetchOrders();
    } catch (error) {
      console.error("Failed to reject order", error);
      toast.error("Order rejection failed.");
    }
  };

  const processRevokePayment = async () => {
    if (orderToRevokeId === null) return;
    setIsRevoking(true);
    try {
      const response = await fetch(`/api/pos/orders/${orderToRevokeId}/revoke`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: revokeReason })
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: "Failed to revoke payment." }));
        toast.error(payload.error ?? "Failed to revoke payment.");
        return;
      }

      toast.success("Payment revoked successfully.");
      setOrderToRevokeId(null);
      setRevokeReason("");
      await fetchOrders();
    } catch (error) {
      console.error("Failed to revoke payment", error);
      toast.error("Payment revocation failed.");
    } finally {
      setIsRevoking(false);
    }
  };

  return (
    <main className="-mx-4 -my-6 flex-1 overflow-y-auto bg-[#F5F8F3] p-4 sm:-mx-6 sm:p-5 lg:-mx-8 lg:-my-8 lg:p-6">
      <div className="mx-auto max-w-7xl">
        <div className="relative mb-7 overflow-hidden rounded-3xl bg-gradient-to-br from-[#0D432D] via-[#125A3B] to-[#1F7A4D] px-6 py-6 text-white shadow-[0_16px_34px_rgba(13,67,45,0.24)] sm:px-8 sm:py-7">
          <div className="absolute -right-10 -top-16 size-56 rounded-full border-[22px] border-[#D8F0DE]/10" />
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-[#F6D354]"><span className="h-2 w-2 rounded-full bg-[#F6D354]" /> Cooperative operations</div>
              <h1 className="text-2xl font-black tracking-tight sm:text-3xl">POS Sales Command Center</h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-white/75">Review orders, verify payments, and keep cooperative sales moving.</p>
            </div>
            <div className="flex shrink-0 items-center gap-3 rounded-2xl border border-[#CDE8D4]/20 bg-[#D8F0DE]/10 px-4 py-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-[#F6D354] text-[#0D432D]"><CircleDollarSign className="size-5" /></div>
              <div><p className="text-xs font-semibold text-white/60">Sales health</p><p className="font-bold">{pendingCount ? `${pendingCount} order${pendingCount > 1 ? "s" : ""} pending` : "All payments validated"}</p></div>
            </div>
          </div>
        </div>

        <div className="mb-7 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            ["Pending Orders", String(pendingCount), "Orders awaiting review"],
            ["Paid Sales", String(paidCount), "Validated transactions"],
            ["Validated Sales", formatMoney(totalSales), "All paid orders"],
            ["Cash Sales", formatMoney(cashSales), "Paid POS orders"],
            ["GCash Sales", formatMoney(gcashSales), "Paid online orders"],
          ].map(([label, value, hint], index) => (
            <div key={label} className="flex min-h-[118px] items-center gap-3 rounded-2xl border border-[#DDE9E0] bg-white p-4 shadow-[0_6px_18px_rgba(18,61,42,0.07)] transition hover:-translate-y-0.5 hover:shadow-[0_10px_22px_rgba(18,61,42,0.12)]">
              <div className="shrink-0 rounded-xl bg-[#EAF5EC] p-2.5 text-[#1F6B43]">{index === 0 ? <AlertCircle className="size-5" /> : index === 1 ? <CheckCircle className="size-5" /> : index === 4 ? <Smartphone className="size-5" /> : <Banknote className="size-5" />}</div>
              <div className="min-w-0"><p className="text-xs font-bold text-gray-500">{label}</p><p className="text-[10px] leading-4 text-gray-400">{hint}</p><p className="break-words text-lg font-black leading-7 text-[#123D2A]">{value}</p></div>
            </div>
          ))}
        </div>

        <div className="mb-6 rounded-2xl border border-[#DCE9DE] bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-[#7d9a89]" />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => { setSearchQuery(event.target.value); setCurrentPage(1); }}
              placeholder="Search order or customer..."
              className="w-full rounded-xl border border-[#d8e4d6] bg-white py-3 pl-12 pr-4 text-sm text-[#123D2A] outline-none transition focus:border-[#0f7a46] focus:ring-2 focus:ring-[#0f7a46]/15"
            />
          </div>
          <div className="flex items-center gap-2">
            <CalendarDays className="hidden size-4 text-[#52705D] sm:block" />
            <PosThemedSelect value={dateFilter} onChange={(value) => { setDateFilter(value); setCurrentPage(1); }} ariaLabel="Filter sales by date" options={['All time', 'Today', 'This week', 'This month'].map((date) => ({ value: date, label: date }))} />
            <button type="button" onClick={() => void refreshOrders()} disabled={isRefreshing} className="inline-flex items-center gap-2 rounded-xl bg-[#123D2A] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#1F6B43] disabled:opacity-60"><RefreshCw className={`size-4 ${isRefreshing ? 'animate-spin' : ''}`} /> <span className="hidden sm:inline">Refresh</span></button>
          </div>
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {["All", "Pending Payment", "Paid", "Rejected"].map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => { setStatusFilter(status); setCurrentPage(1); }}
                className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition ${
                  statusFilter === status
                    ? "bg-[#123D2A] text-white shadow-sm"
                    : "bg-white text-[#365944] hover:bg-[#edf5ed]"
                }`}
              >
                {status}
              </button>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs font-medium text-[#789181]">
            <span>Showing {filteredOrders.length === 0 ? 0 : ((currentPage - 1) * itemsPerPage) + 1}–{Math.min(currentPage * itemsPerPage, filteredOrders.length)} of {filteredOrders.length} orders</span>
            {lastUpdated && <span>Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
          </div>
        </div>

        {isLoading ? (
          <div className="rounded-2xl border border-[#d8e4d6] bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-3 text-sm font-semibold text-[#607a6b]"><Loader2 className="size-5 animate-spin text-[#1F6B43]" /> Loading POS sales...</div>
            <div className="space-y-3">{[1, 2, 3].map((row) => <div key={row} className="h-14 animate-pulse rounded-xl bg-[#EEF5EF]" />)}</div>
          </div>
        ) : loadError ? (
          <div className="rounded-2xl border border-red-200 bg-white p-12 text-center shadow-sm">
            <AlertCircle className="mx-auto mb-3 size-10 text-red-500" />
            <h2 className="text-lg font-bold text-[#123D2A]">Unable to load sales</h2>
            <p className="mt-1 text-sm text-[#607a6b]">{loadError}</p>
            <button type="button" onClick={() => void refreshOrders()} className="mt-5 rounded-xl bg-[#123D2A] px-4 py-2 text-sm font-bold text-white hover:bg-[#1F6B43]">Try again</button>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#b9cdbc] bg-white p-12 text-center">
            <ShoppingBag className="mx-auto mb-3 size-10 text-[#9bb4a4]" />
            <h2 className="text-lg font-bold text-[#123D2A]">No POS sales found</h2>
            <p className="mt-1 text-sm text-[#607a6b]">{searchQuery || statusFilter !== "All" || dateFilter !== "All time" ? "Try changing your search or filters." : "Orders from the member shop and public store will appear here."}</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[#d8e4d6] bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#fbfcfa] font-bold text-[#607a6b]">
                <tr>
                  <th className="border-b border-[#d8e4d6] px-4 py-3">Sale #</th>
                  <th className="border-b border-[#d8e4d6] px-4 py-3">Date</th>
                  <th className="border-b border-[#d8e4d6] px-4 py-3">Customer</th>
                  <th className="border-b border-[#d8e4d6] px-4 py-3">Total</th>
                  <th className="border-b border-[#d8e4d6] px-4 py-3">Status</th>
                  <th className="border-b border-[#d8e4d6] px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#edf3ec]">
                {paginatedOrders.map((order) => (
                  <tr key={order.id} className="transition hover:bg-[#f8faf5]">
                    <td className="px-4 py-3 font-bold text-[#123D2A]">{order.sale_number}</td>
                    <td className="px-4 py-3 text-[#607a6b] whitespace-nowrap">{new Date(order.sale_date).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-[#123D2A]">{order.customer_name || "Walk-in"}</td>
                    <td className="px-4 py-3 font-black text-[#123D2A] whitespace-nowrap">{formatMoney(order.total_amount)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold whitespace-nowrap ${
                        order.sale_status === "Pending Payment"
                          ? "bg-[#fff0d8] text-[#9a5a00]"
                          : order.sale_status === "Paid"
                            ? "bg-[#e1f6e7] text-[#126b37]"
                            : order.sale_status === "Rejected"
                              ? "bg-[#fff1f1] text-[#b42318]"
                            : "bg-[#eef1f0] text-[#607a6b]"
                      }`}>
                        {order.sale_status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setDetailsOrder(order)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-[#d8e4d6] bg-white px-2.5 py-1.5 text-xs font-bold text-[#123D2A] transition hover:bg-[#edf5ed]"
                          title="View Details"
                        >
                          <Eye className="size-3.5" />
                          Details
                        </button>

                        {order.sale_status === "Pending Payment" ? (
                          <>
                            <button
                              type="button"
                              onClick={() => confirmPayment(order.id)}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-[#123D2A] px-2.5 py-1.5 text-xs font-bold text-white transition hover:bg-[#0d2f20]"
                              title="Confirm Payment"
                            >
                              <CheckCircle className="size-3.5" />
                              Confirm
                            </button>
                            <button
                              type="button"
                              onClick={() => setOrderToRejectId(order.id)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-bold text-red-700 transition hover:bg-red-50"
                              title="Reject"
                            >
                              <XCircle className="size-3.5" />
                            </button>
                          </>
                        ) : null}

                        {order.sale_status === "Paid" ? (
                          <>
                            <button
                              type="button"
                              onClick={() => setReceiptOrder(order)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-[#d8e4d6] bg-white px-2.5 py-1.5 text-xs font-bold text-[#123D2A] transition hover:bg-[#edf5ed]"
                              title="View Receipt"
                            >
                              <Printer className="size-3.5" />
                              Receipt
                            </button>
                            <button
                              type="button"
                              onClick={() => setOrderToRevokeId(order.id)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-bold text-red-700 transition hover:bg-red-50"
                              title="Revoke Payment"
                            >
                              <RotateCcw className="size-3.5" />
                            </button>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-[#d8e4d6] bg-[#fbfcfa] px-4 py-3">
                <div className="flex flex-1 justify-between sm:hidden">
                  <button
                    onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
                <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-center gap-4">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage === 1}
                      className="p-1 rounded-md border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-50 transition"
                    >
                      <ChevronsLeft className="size-4" />
                    </button>
                    <button
                      onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="p-1 rounded-md border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-50 transition"
                    >
                      <ChevronLeft className="size-4" />
                    </button>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#123D2A]">
                      Page <span className="font-bold">{currentPage}</span> of <span className="font-bold">{totalPages}</span> <span className="mx-1 text-gray-300">•</span> <span className="font-bold">{filteredOrders.length}</span> orders
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className="p-1 rounded-md border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-50 transition"
                    >
                      <ChevronRight className="size-4" />
                    </button>
                    <button
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={currentPage === totalPages}
                      className="p-1 rounded-md border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-50 transition"
                    >
                      <ChevronsRight className="size-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Order Details Modal */}
      {detailsOrder && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl bg-white shadow-xl animate-in zoom-in-95 duration-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 bg-gray-50">
              <div>
                <h2 className="text-lg font-bold text-[#123D2A]">Order Details</h2>
                <p className="text-xs text-gray-500">{detailsOrder.sale_number}</p>
              </div>
              <button onClick={() => setDetailsOrder(null)} className="text-gray-400 hover:text-gray-900 transition bg-white rounded-full p-1 shadow-sm border border-gray-100">
                <X className="size-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-white">
              <div className="mb-6 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs font-bold uppercase text-gray-500 mb-1">Customer</p>
                  <p className="font-semibold text-gray-900">{detailsOrder.customer_name || "Walk-in"}</p>
                  <p className="text-gray-600">{detailsOrder.customer_contact}</p>
                  <p className="text-gray-600">{detailsOrder.customer_email}</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase text-gray-500 mb-1">Payment Method</p>
                  <div className="flex items-center gap-1.5 font-semibold text-gray-900">
                    {detailsOrder.payment_reference_id ? <Smartphone className="size-4" /> : <Banknote className="size-4" />}
                    {detailsOrder.payment_reference_id ? "Online Payment" : "Cash Payment"}
                  </div>
                  <p className="text-gray-600 mt-1">{detailsOrder.reference_number ? `Ref: ${detailsOrder.reference_number}` : "No reference ID"}</p>
                </div>
              </div>

              <div className="border border-gray-100 rounded-xl overflow-hidden">
                <div className="bg-gray-50 px-4 py-2 border-b border-gray-100 text-xs font-bold uppercase text-gray-500">Items Bought</div>
                <div className="divide-y divide-gray-100 p-2">
                  {(detailsOrder.items ?? []).map((item, index) => (
                    <div key={index} className="flex items-center justify-between px-2 py-3 text-sm">
                      <span className="font-semibold text-gray-800">{item.quantity} x {item.name}</span>
                      <span className="font-bold text-gray-900">{formatMoney(Number(item.price) * Number(item.quantity))}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Payment Modal */}
      {orderToConfirmId !== null && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl bg-white p-8 text-center shadow-xl animate-in zoom-in-95 duration-200">
            <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-green-100 text-[#123D2A]">
              <CheckCircle className="size-6" />
            </div>
            <h2 className="mb-2 text-xl font-bold text-gray-900">Verify Payment</h2>
            <p className="mb-6 text-sm text-gray-500">
              Please ensure you have received the exact amount. Stock will be automatically deducted upon confirmation.
            </p>
            
            <div className="mb-6 text-left">
              <label className="mb-1 block text-sm font-medium text-gray-700">Add Discount % (Optional)</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium">%</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="any"
                  onKeyDown={(e) => {
                    if (['e', 'E', '+', '-'].includes(e.key)) e.preventDefault();
                  }}
                  placeholder="0.00"
                  value={confirmDiscountAmount}
                  onChange={(e) => {
                    let val = e.target.value.replace(/[^0-9.]/g, '');
                    if ((val.match(/\./g) || []).length > 1) val = val.substring(0, val.lastIndexOf('.'));
                    if (Number(val) > 100) val = "100";
                    setConfirmDiscountAmount(val);
                    if (confirmDiscountError) setConfirmDiscountError("");
                  }}
                  className={`w-full rounded-xl border ${confirmDiscountError ? 'border-red-500 focus:border-red-500 focus:ring-red-200' : 'border-gray-200 focus:border-[#123D2A]'} bg-gray-50 p-3 pl-8 text-sm outline-none transition focus:bg-white focus:ring-1`}
                />
              </div>
              {confirmDiscountError && <p className="mt-1 text-xs text-red-500">{confirmDiscountError}</p>}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { setOrderToConfirmId(null); setConfirmDiscountAmount(""); }}
                className="flex-1 rounded-xl border border-gray-200 bg-white py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={processConfirmPayment}
                disabled={isConfirming}
                className="flex-1 rounded-xl border border-transparent bg-[#123D2A] py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#123D2A]/90 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isConfirming ? "Verifying..." : "Verify"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Payment Modal */}
      {orderToRejectId !== null && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl bg-white p-8 text-center shadow-xl animate-in zoom-in-95 duration-200">
            <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-red-100 text-red-600">
              <AlertCircle className="size-6" />
            </div>
            <h2 className="mb-2 text-xl font-bold text-gray-900">Reject Order</h2>
            <p className="mb-4 text-sm text-gray-500">
              Are you sure you want to reject this order? This action cannot be undone.
            </p>
            <div className="text-left mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-1">Reason for Rejection (Optional)</label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm outline-none transition focus:border-red-500 focus:bg-white focus:ring-1 focus:ring-red-200 resize-none h-24"
                placeholder="Enter reason..."
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setOrderToRejectId(null)}
                className="flex-1 rounded-xl border border-gray-200 bg-white py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={processRejectPayment}
                className="flex-1 rounded-xl border border-transparent bg-red-600 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-red-700"
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      {receiptOrder && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl bg-white shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50">
              <h2 className="text-lg font-bold text-gray-900">Receipt</h2>
              <button onClick={() => setReceiptOrder(null)} className="text-gray-400 hover:text-gray-900 transition">
                <X className="size-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6" id="printable-receipt">
              <div className="text-center mb-6">
                <h1 className="text-xl font-black text-gray-900 mb-1 tracking-tight">TRACKCOOP</h1>
                <p className="text-xs text-gray-500">Cooperative POS & Inventory</p>
                <div className="mt-4 text-sm text-gray-600">
                  <p>Order #: {receiptOrder.sale_number}</p>
                  <p>{new Date(receiptOrder.sale_date).toLocaleString()}</p>
                </div>
              </div>

              <div className="border-t border-b border-dashed border-gray-300 py-4 mb-4">
                <div className="text-xs text-gray-500 mb-2 font-semibold">CUSTOMER</div>
                <p className="text-sm font-bold text-gray-900">{receiptOrder.customer_name || 'Walk-in'}</p>
                {receiptOrder.customer_email && <p className="text-xs text-gray-600">{receiptOrder.customer_email}</p>}
                {receiptOrder.customer_contact && <p className="text-xs text-gray-600">{receiptOrder.customer_contact}</p>}
              </div>

              <div className="mb-4">
                <div className="text-xs text-gray-500 mb-2 font-semibold">ITEMS</div>
                <div className="space-y-2">
                  {receiptOrder.items?.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-start text-sm">
                      <div>
                        <p className="font-medium text-gray-800">{item.name}</p>
                        <p className="text-xs text-gray-500">{item.quantity} x ₱{Number(item.price).toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                      </div>
                      <p className="font-bold text-gray-900">₱{(Number(item.price) * Number(item.quantity)).toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-dashed border-gray-300 pt-4 mb-4 space-y-1">
                <div className="flex justify-between items-center text-sm text-gray-600">
                  <span>Subtotal</span>
                  <span>₱{Number(receiptOrder.subtotal_amount || receiptOrder.total_amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                </div>
                {(() => {
                  const subtotal = Number(receiptOrder.subtotal_amount || receiptOrder.total_amount);
                  const totalDiscount = Number(receiptOrder.discount_amount);
                  
                  if (totalDiscount <= 0) return null;

                  // We check if member discount was applied by seeing if there's an email (or assuming member if discount exists and no other clear way to check in this component right now)
                  // Let's use the same heuristic as before: 5% member discount.
                  const expectedMemberDiscount = subtotal * 0.05;
                  
                  // If they have at least the member discount amount, assume they got the member discount
                  const hasMemberDiscount = totalDiscount >= expectedMemberDiscount - 0.01;
                  const actualMemberDiscount = hasMemberDiscount ? expectedMemberDiscount : 0;
                  const additionalDiscount = Math.max(0, totalDiscount - actualMemberDiscount);
                  
                  return (
                      <>
                          {actualMemberDiscount > 0 && (
                              <div className="flex justify-between items-center text-sm text-red-500 font-medium">
                                  <span>Member Discount (5%)</span>
                                  <span>- ₱{actualMemberDiscount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                              </div>
                          )}
                          {additionalDiscount > 0.01 && (
                              <div className="flex justify-between items-center text-sm text-red-500 font-medium">
                                  <span>Additional Discount ({Math.round((additionalDiscount / subtotal) * 100)}%)</span>
                                  <span>- ₱{additionalDiscount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                              </div>
                          )}
                      </>
                  );
                })()}
                <div className="flex justify-between items-center text-base font-bold text-gray-900 pt-2 border-t border-gray-100">
                  <span>TOTAL</span>
                  <span>₱{Number(receiptOrder.total_amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              <div className="text-center">
                <p className="text-xs font-semibold text-gray-500 mb-1 uppercase">Payment Method</p>
                <p className="text-sm font-bold text-gray-900">
                  {receiptOrder.payment_reference_id && receiptOrder.provider !== 'Cash' ? `${receiptOrder.provider || 'GCash'} (${receiptOrder.reference_number})` : 'Cash'}
                </p>
              </div>
            </div>

            <div className="p-4 border-t border-gray-100 bg-gray-50">
              <button 
                onClick={() => {
                  const receiptContent = document.getElementById('printable-receipt')?.innerHTML;
                  if (receiptContent) {
                    const printWindow = window.open('', '_blank');
                    printWindow?.document.write(`
                      <html>
                        <head>
                          <title>Receipt - ${receiptOrder.sale_number}</title>
                          <style>
                            body { font-family: monospace; padding: 20px; color: #000; }
                            h1 { text-align: center; font-size: 24px; margin: 0 0 5px 0; }
                            p { margin: 2px 0; }
                            .text-center { text-align: center; }
                            .mb-6 { margin-bottom: 24px; }
                            .mb-4 { margin-bottom: 16px; }
                            .border-t { border-top: 1px dashed #ccc; }
                            .border-b { border-bottom: 1px dashed #ccc; }
                            .py-4 { padding-top: 16px; padding-bottom: 16px; }
                            .pt-4 { padding-top: 16px; }
                            .flex { display: flex; justify-content: space-between; }
                            .text-xs { font-size: 12px; }
                            .text-sm { font-size: 14px; }
                            .font-bold { font-weight: bold; }
                            .font-semibold { font-weight: 600; }
                            .text-gray-500 { color: #666; }
                          </style>
                        </head>
                        <body>
                          ${receiptContent}
                          <div style="text-align: center; margin-top: 30px; font-size: 12px; color: #666;">
                            Thank you for your business!
                          </div>
                          <script>window.print(); window.close();</script>
                        </body>
                      </html>
                    `);
                    printWindow?.document.close();
                  }
                }}
                className="w-full rounded-xl bg-[#123D2A] py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#123D2A]/90 flex items-center justify-center gap-2"
              >
                <Printer className="size-4" />
                Print Receipt
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Revoke Payment Modal */}
      {orderToRevokeId !== null && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/50 px-6 py-5">
              <h3 className="text-xl font-black text-gray-900">Revoke Payment</h3>
              <button
                onClick={() => setOrderToRevokeId(null)}
                className="rounded-xl bg-white p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="p-6">
              <p className="text-gray-600">Are you sure you want to revoke this payment?</p>
              <p className="mt-2 rounded-xl border border-red-100 bg-red-50 p-3 text-sm font-semibold text-red-600">
                This will reset the order back to Pending, restore stock into inventory, and void associated financial records.
              </p>
              <div className="mt-4 text-left">
                <label className="block text-sm font-semibold text-gray-700 mb-1">Reason for Revocation (Optional)</label>
                <textarea
                  value={revokeReason}
                  onChange={(e) => setRevokeReason(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm outline-none transition focus:border-red-500 focus:bg-white focus:ring-1 focus:ring-red-200 resize-none h-24"
                  placeholder="Enter reason..."
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 border-t border-gray-100 bg-gray-50 px-6 py-4">
              <button
                onClick={() => setOrderToRevokeId(null)}
                className="rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-bold text-gray-600 shadow-sm transition-all hover:border-gray-300 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => void processRevokePayment()}
                disabled={isRevoking}
                className="flex items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-red-600/20 transition-all hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isRevoking ? <Loader2 className="size-4 animate-spin" /> : null}
                Revoke Payment
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
