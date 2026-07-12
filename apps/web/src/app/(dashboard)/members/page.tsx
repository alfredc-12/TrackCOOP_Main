import { MemberTable } from "@/features/members/components/MemberTable";

export default function MembersPage() {
  return (
    <div className="grid gap-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#4d8f5b]">
          Registry
        </p>
        <h2 className="mt-2 text-3xl font-semibold tracking-normal">Members</h2>
      </div>
      <MemberTable />
    </div>
  );
}
