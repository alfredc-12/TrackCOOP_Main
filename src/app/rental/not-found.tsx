import Link from "next/link";

export default function RentalNotFound() {
  return <main className="grid min-h-[70dvh] place-items-center px-5 text-center"><section><p className="text-sm font-bold uppercase tracking-[0.2em] text-[#1f6b43]">Rental 404</p><h1 className="mt-3 text-4xl font-bold text-[#123d2a]">Rental record not found</h1><p className="mt-3 text-[#66756c]">The requested rental page or record is unavailable.</p><Link href="/rental" className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-[#123d2a] px-5 font-bold text-white">Return to Rental Services</Link></section></main>;
}
