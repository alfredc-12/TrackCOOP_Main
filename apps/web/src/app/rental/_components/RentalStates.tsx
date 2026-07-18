import { AlertTriangle, Inbox, LoaderCircle, LockKeyhole } from "lucide-react";
import Link from "next/link";

export function RentalLoadingState({ label = "Loading rental information" }: { label?: string }) {
  return <div role="status" className="grid min-h-56 place-items-center rounded-2xl border border-[#dce7d6] bg-white p-8 text-center"><div><LoaderCircle className="mx-auto mb-3 size-8 animate-spin text-[#1f6b43] motion-reduce:animate-none" /><p className="font-semibold text-[#365f4a]">{label}…</p></div></div>;
}

export function RentalEmptyState({ title = "No records found", description = "Try changing the current search or filters." }: { title?: string; description?: string }) {
  return <div className="grid min-h-56 place-items-center rounded-2xl border border-dashed border-[#b9cdb2] bg-[#f8fbf5] p-8 text-center"><div><Inbox className="mx-auto mb-3 size-9 text-[#5d7b69]" /><h2 className="text-lg font-bold text-[#123d2a]">{title}</h2><p className="mt-1 text-sm text-[#5d6d62]">{description}</p></div></div>;
}

export function RentalErrorState({ message, retry }: { message: string; retry?: () => void }) {
  return <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-900"><AlertTriangle className="mb-3 size-7" /><h2 className="font-bold">Rental information is unavailable</h2><p className="mt-1 text-sm">{message}</p>{retry && <button type="button" onClick={retry} className="mt-4 min-h-11 rounded-xl bg-red-900 px-4 py-2 text-sm font-bold text-white">Try again</button>}</div>;
}

export function RentalPermissionState({ role }: { role: string }) {
  return <div className="mx-auto grid min-h-[60vh] max-w-xl place-items-center p-6 text-center"><div className="rounded-3xl border border-[#dce7d6] bg-white p-10 shadow-sm"><LockKeyhole className="mx-auto mb-4 size-10 text-[#1f6b43]" /><h1 className="text-2xl font-bold text-[#123d2a]">Access is limited for this role</h1><p className="mt-3 text-[#5d6d62]">The {role} role is not authorized for this rental workspace. Choose an area assigned to your TrackCOOP role.</p><Link href="/rental" className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-[#123d2a] px-5 font-bold text-white">Return to Rental Services</Link></div></div>;
}
