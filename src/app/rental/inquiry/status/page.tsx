import { redirect } from "next/navigation";

/**
 * Booking status now opens as a dialog over the rental page. This route stays so older emails and links keep
 * working: it forwards the booking reference and token (if any) to /rental, where the dialog opens.
 */
export default async function InquiryStatusPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const forwarded = new URLSearchParams();
  for (const name of ["booking", "k"]) {
    const value = params[name];
    if (typeof value === "string" && value) forwarded.set(name, value);
  }
  if (!forwarded.has("booking")) forwarded.set("check", "1");
  redirect(`/rental?${forwarded.toString()}`);
}
