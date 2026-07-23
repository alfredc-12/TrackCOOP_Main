"use client";

import { useEffect, useState } from "react";
import { Search, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { format } from "date-fns";

type ActivityItem = {
  id: string | number;
  date: string;
  amount: number | string;
  status: string;
  type: string;
};

export default function ActivityModal({ 
  open, 
  onOpenChange 
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void 
}) {
  const [data, setData] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const pageSize = 8; // Number of items per page

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1); // Reset to page 1 on search
    }, 400);
    return () => clearTimeout(handler);
  }, [search]);

  useEffect(() => {
    if (!open) return;

    setLoading(true);
    fetch(`/api/members/me/activity?page=${page}&pageSize=${pageSize}&search=${encodeURIComponent(debouncedSearch)}`)
      .then(res => res.json())
      .then(result => {
        if (result.records) {
          setData(result.records);
          setTotalPages(result.totalPages || 1);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [page, debouncedSearch, open]);

  return (
    <Modal
      title="All Recent Activity"
      description="View all your transactions, purchases, and capital deposits."
      open={open}
      onOpenChange={onOpenChange}
      trigger={<span className="hidden"></span>}
      maxWidth="max-w-4xl"
    >
      <div className="mt-4">
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by transaction type or status..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-full border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-[#2F7D57] focus:ring-1 focus:ring-[#2F7D57]"
          />
        </div>

        <div className="min-h-[400px] rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[#E5E7EB] bg-gray-50 text-[#6B7280]">
              <tr>
                <th className="py-3 px-4 font-semibold">Transaction</th>
                <th className="py-3 px-4 font-semibold">Date</th>
                <th className="py-3 px-4 font-semibold">Amount</th>
                <th className="py-3 px-4 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E7EB]">
              {loading ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-gray-500">Loading activity...</td>
                </tr>
              ) : data.length > 0 ? (
                data.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-[#123D2A]">{item.type}</div>
                      <div className="text-xs text-[#6B7280]">Ref: {item.id}</div>
                    </td>
                    <td className="py-3 px-4 text-[#4b6b5a]">
                      {item.date ? format(new Date(item.date), "MMM dd, yyyy") : "N/A"}
                    </td>
                    <td className="py-3 px-4 font-semibold text-[#123D2A]">
                      ₱{Number(item.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                        item.status === 'Completed' || item.status === 'Validated' || item.status === 'Paid'
                          ? 'bg-[#E8F5E9] text-[#2E7D32]'
                          : item.status === 'Pending' || item.status === 'Draft'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-gray-500">No activity found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="flex items-center justify-center mt-4 border-t border-gray-100 pt-4">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setPage(1)}
              disabled={page === 1 || loading}
              className="p-1.5 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              title="First Page"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1 || loading}
              className="p-1.5 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Previous Page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            
            <div className="text-sm text-gray-500 px-4">
              Page <span className="font-semibold text-gray-900">{page}</span> of <span className="font-semibold text-gray-900">{totalPages}</span>
            </div>

            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages || totalPages === 0 || loading}
              className="p-1.5 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Next Page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage(totalPages)}
              disabled={page === totalPages || totalPages === 0 || loading}
              className="p-1.5 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Last Page"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
