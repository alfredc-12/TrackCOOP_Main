import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    { error: "Account unlock endpoint is disabled. Use the chairman user management tools instead." },
    { status: 410 },
  );
}
