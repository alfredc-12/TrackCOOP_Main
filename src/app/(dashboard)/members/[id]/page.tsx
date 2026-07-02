import Link from "next/link";
import { Button } from "@/components/ui/Button";

export default async function MemberDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="max-w-3xl rounded-lg border border-black/10 bg-white p-6">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#4d8f5b]">
        Member profile
      </p>
      <h2 className="mt-3 text-3xl font-semibold tracking-normal">Member {id}</h2>
      <p className="mt-4 leading-7 text-[#657169]">
        This profile page is ready for member participation, payment history,
        alerts, and documents once backend services are added.
      </p>
      <Link href="/members" className="mt-6 inline-flex">
        <Button variant="secondary">Back to members</Button>
      </Link>
    </div>
  );
}
