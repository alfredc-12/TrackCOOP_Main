"use client";

import { Search } from "lucide-react";
import { useState } from "react";
import { formatRentalDate } from "../_lib/rentalFormatting";
import { rentalRepository } from "../_lib/rentalRepository";
import { useRentalData } from "../_hooks/useRentalData";
import { RentalAccessGate } from "./RentalAccessGate";
import { RentalEmptyState, RentalLoadingState } from "./RentalStates";
import { RentalPageHeader } from "./RentalPageHeader";

export function RentalAudit() {
  const { data = [], loading } = useRentalData(() => rentalRepository.getRentalAuditEntries(), []);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("All roles");
  const filtered = data.filter((item) => `${item.action} ${item.rentalId} ${item.equipmentName} ${item.user}`.toLowerCase().includes(search.toLowerCase()) && (role === "All roles" || item.role === role));
  return <RentalAccessGate capability="audit"><RentalPageHeader title="Rental audit trail" description="Review accountable changes to services, inquiries, schedules, payments, expenses, receipts, operations, and reports." /><div className="mb-4 grid gap-3 rounded-2xl border border-[#dce7d6] bg-white p-4 sm:grid-cols-2 lg:grid-cols-6"><label className="relative lg:col-span-2"><span className="sr-only">Search audit</span><Search className="absolute left-3 top-3.5 size-4 text-[#75837a]" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search action, rental, equipment, user" className="h-11 w-full rounded-xl border pl-9 pr-3 text-sm" /></label><input type="date" aria-label="Audit date" /><select value={role} onChange={(event) => setRole(event.target.value)} aria-label="Role"><option>All roles</option><option>Chairman</option><option>Admin</option><option>Bookkeeper</option></select><select aria-label="Action"><option>All actions</option><option>Created Schedule</option><option>Confirmed Payment</option><option>Recorded Expense</option></select><input aria-label="Rental ID" placeholder="Rental ID" /> </div>{loading ? <RentalLoadingState /> : filtered.length ? <div className="overflow-x-auto rounded-2xl border border-[#dce7d6] bg-white"><table className="w-full min-w-[1500px] text-left text-sm"><thead className="bg-[#eef5eb] text-xs uppercase text-[#53675a]"><tr>{["Date and Time", "User", "Role", "Action", "Rental ID", "Equipment", "Record Affected", "Previous Value", "New Value", "Reason", "Status", "Details"].map((item) => <th key={item} className="p-3">{item}</th>)}</tr></thead><tbody>{filtered.map((item) => <tr key={item.auditId} className="border-b"><td className="p-3">{formatRentalDate(item.createdAt)}</td><td className="p-3 font-bold">{item.user}</td><td className="p-3">{item.role}</td><td className="p-3 font-bold text-[#284735]">{item.action}</td><td className="p-3 font-mono text-xs">{item.rentalId ?? "—"}</td><td className="p-3">{item.equipmentName ?? "—"}</td><td className="p-3">{item.recordAffected}</td><td className="p-3">{item.previousValue ?? "—"}</td><td className="p-3">{item.newValue ?? "—"}</td><td className="p-3">{item.reason ?? "—"}</td><td className="p-3"><span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-800">{item.status}</span></td><td className="p-3">{item.details}</td></tr>)}</tbody></table></div> : <RentalEmptyState title="No audit entries match these filters" />}</RentalAccessGate>;
}
