import Link from "next/link";
import { DataTable } from "@/components/shared/DataTable";
import { getMembersOverview } from "../service";

export function MemberTable() {
  const data = getMembersOverview().map((member) => ({
    id: member.id,
    name: member.name,
    sector: member.sector,
    location: member.location,
    status: member.status,
    profile: "Open",
  }));

  return (
    <div className="grid gap-4">
      <DataTable
        columns={[
          { key: "id", label: "ID" },
          { key: "name", label: "Cooperative" },
          { key: "sector", label: "Sector" },
          { key: "location", label: "Location" },
          { key: "status", label: "Status" },
        ]}
        data={data}
      />
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {getMembersOverview().map((member) => (
          <Link
            key={member.id}
            href={`/members/${member.id}`}
            className="rounded-lg border border-black/10 bg-white p-4 transition hover:-translate-y-1 hover:shadow-md"
          >
            <p className="text-sm font-semibold text-[#657169]">{member.id}</p>
            <h3 className="mt-2 font-semibold">{member.name}</h3>
          </Link>
        ))}
      </div>
    </div>
  );
}
