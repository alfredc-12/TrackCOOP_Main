import { MembersClient } from "./MembersClient";
import { Suspense } from "react";

export default function ChairmanMembersPage() {
  return <Suspense fallback={<p role="status">Loading member management…</p>}><MembersClient /></Suspense>;
}
