import { NextResponse } from "next/server";
import { getServerAuthUser } from "@/lib/auth-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getServerAuthUser();
  return NextResponse.json({ user });
}
