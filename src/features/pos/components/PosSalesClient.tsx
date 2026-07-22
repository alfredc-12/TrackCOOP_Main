"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Banknote, CheckCircle, Printer, Search, ShoppingBag, Smartphone, XCircle } from "lucide-react";
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
  total_amount: number | string;
  customer_name?: string | null;
  customer_email?: string | null;
  customer_contact?: string | null;
  payment_reference_id?: number | string | null;
  provider?: string | null;
  reference_number?: string | null;
  items?: PosOrderItem[];
};

function formatMoney(value: number | string) {
  return `P ${Number(value).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
}

export default function PosSalesClient() {
  const [orders, setOrders] = useState<PosOrder[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [isLoading, setIsLoading] = useState(true);
  const [activeOrderId, setActiveOrderId] = useState<number | null>(null);

  const fetchOrders = useCallback(async () => {
    try {
      const response = await fetch("/api/pos/orders", { cache: "no-store" });
      if (!response.ok) {
        setOrders([]);
        return;
      }

      setOrders((await response.json()) as PosOrder[]);
    } catch (error) {
      console.error("Failed to fetch POS orders", error);
      setOrders([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

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

  const filteredOrders = useMemo(() => {
    const query = searchQuery.toLowerCase();

    return orders.filter((order) => {
      const matchesStatus = statusFilter === "All" || order.sale_status === statusFilter;
      const matchesSearch =
        order.sale_number.toLowerCase().includes(query) ||
        (order.customer_name ?? "").toLowerCase().includes(query) ||
        (order.customer_contact ?? "").toLowerCase().includes(query);

      return matchesStatus && matchesSearch;
    });
  }, [orders, searchQuery, statusFilter]);

  const pendingCount = orders.filter((order) => order.sale_status === "Pending Payment").length;
  const paidCount = orders.filter((order) => order.sale_status === "Paid").length;
  const totalSales = orders
    .filter((order) => order.sale_status === "Paid")
    .reduce((sum, order) => sum + Number(order.total_amount), 0);

  async function updateOrder(orderId: number, action: "confirm" | "reject") {
    setActiveOrderId(orderId);
    try {
      const response = await fetch(`/api/pos/orders/${orderId}/${action}`, { method: "PUT" });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: "Order update failed." }));
        toast.error(payload.error ?? "Order update failed.");
        return;
      }

      toast.success(action === "confirm" ? "Payment confirmed." : "Order rejected.");
      await fetchOrders();
    } catch (error) {
      console.error("Failed to update POS order", error);
      toast.error("Order update failed.");
    } finally {
      setActiveOrderId(null);
    }
  }

  return (
    <main className="flex-1 overflow-y-auto bg-[#f8faf5] p-6 sm:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 border-b border-[#d8e4d6] pb-6">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.35em] text-[#c78800]">Operations</p>
          <h1 className="text-4xl font-black tracking-tight text-[#09351f]">POS Sales</h1>
          <p className="mt-3 max-w-3xl text-sm text-[#365944]">
            Review cooperative store orders, verify payments, and finalize sales. Stock is managed from Inventory.
          </p>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-[#d8e4d6] bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-[#607a6b]">Pending Orders</p>
            <p className="mt-2 text-3xl font-black text-[#123D2A]">{pendingCount}</p>
          </div>
          <div className="rounded-xl border border-[#d8e4d6] bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-[#607a6b]">Paid Sales</p>
            <p className="mt-2 text-3xl font-black text-[#123D2A]">{paidCount}</p>
          </div>
          <div className="rounded-xl border border-[#d8e4d6] bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-[#607a6b]">Validated Sales</p>
            <p className="mt-2 text-3xl font-black text-[#123D2A]">{formatMoney(totalSales)}</p>
          </div>
        </div>

        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-[#7d9a89]" />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search order or customer..."
              className="w-full rounded-xl border border-[#d8e4d6] bg-white py-3 pl-12 pr-4 text-sm text-[#123D2A] outline-none transition focus:border-[#0f7a46] focus:ring-2 focus:ring-[#0f7a46]/15"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1">
            {["All", "Pending Payment", "Paid", "Cancelled"].map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
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
        </div>

        {isLoading ? (
          <div className="rounded-xl border border-[#d8e4d6] bg-white p-12 text-center text-sm font-semibold text-[#607a6b]">
            Loading POS sales...
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#b9cdbc] bg-white p-12 text-center">
            <ShoppingBag className="mx-auto mb-3 size-10 text-[#9bb4a4]" />
            <h2 className="text-lg font-bold text-[#123D2A]">No POS sales found</h2>
            <p className="mt-1 text-sm text-[#607a6b]">Orders from the member shop and public store will appear here.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredOrders.map((order) => (
              <article key={order.id} className="rounded-xl border border-[#d8e4d6] bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="text-lg font-black text-[#123D2A]">{order.sale_number}</h2>
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${
                        order.sale_status === "Pending Payment"
                          ? "bg-[#fff0d8] text-[#9a5a00]"
                          : order.sale_status === "Paid"
                            ? "bg-[#e1f6e7] text-[#126b37]"
                            : "bg-[#eef1f0] text-[#607a6b]"
                      }`}>
                        {order.sale_status}
                      </span>
                    </div>
                    <p suppressHydrationWarning className="mt-1 text-sm text-[#607a6b]">
                      {new Date(order.sale_date).toLocaleString()}
                    </p>
                    <p className="mt-3 text-sm font-semibold text-[#123D2A]">{order.customer_name || "Walk-in customer"}</p>
                    <p className="text-sm text-[#607a6b]">{order.customer_contact || "No contact number"}</p>
                  </div>

                  <div className="flex flex-col items-start gap-3 lg:items-end">
                    <p className="text-2xl font-black text-[#123D2A]">{formatMoney(order.total_amount)}</p>
                    {order.sale_status === "Pending Payment" ? (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => void updateOrder(order.id, "reject")}
                          disabled={activeOrderId === order.id}
                          className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-bold text-red-700 transition hover:bg-red-50 disabled:opacity-60"
                        >
                          <XCircle className="size-4" />
                          Reject
                        </button>
                        <button
                          type="button"
                          onClick={() => void updateOrder(order.id, "confirm")}
                          disabled={activeOrderId === order.id}
                          className="inline-flex items-center gap-2 rounded-xl bg-[#123D2A] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#0d2f20] disabled:opacity-60"
                        >
                          <CheckCircle className="size-4" />
                          Confirm Payment
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="mt-5 grid gap-4 border-t border-[#edf3ec] pt-5 lg:grid-cols-[1fr_18rem]">
                  <div>
                    <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[#7d9a89]">Items</p>
                    <div className="space-y-2">
                      {(order.items ?? []).map((item, index) => (
                        <div key={`${order.id}-${index}`} className="flex items-center justify-between rounded-lg bg-[#f8faf5] px-3 py-2 text-sm">
                          <span className="font-semibold text-[#365944]">{item.quantity} x {item.name}</span>
                          <span className="font-bold text-[#123D2A]">{formatMoney(Number(item.price) * Number(item.quantity))}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-lg border border-[#edf3ec] bg-[#fbfcfa] p-4">
                    <div className="mb-3 flex items-center gap-2 text-sm font-bold text-[#123D2A]">
                      {order.payment_reference_id ? <Smartphone className="size-4" /> : <Banknote className="size-4" />}
                      {order.payment_reference_id ? "Online Payment" : "Cash Payment"}
                    </div>
                    <p className="text-sm text-[#607a6b]">
                      {order.reference_number ? `Reference: ${order.reference_number}` : "No payment reference submitted."}
                    </p>
                    {order.customer_email ? <p className="mt-1 text-sm text-[#607a6b]">{order.customer_email}</p> : null}
                    {order.sale_status === "Paid" ? (
                      <button
                        type="button"
                        onClick={() => window.print()}
                        className="mt-4 inline-flex items-center gap-2 rounded-lg border border-[#d8e4d6] bg-white px-3 py-2 text-xs font-bold text-[#123D2A] transition hover:bg-[#edf5ed]"
                      >
                        <Printer className="size-3.5" />
                        Print Page
                      </button>
                    ) : null}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
