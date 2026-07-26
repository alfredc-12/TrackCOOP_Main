import { NextResponse } from "next/server";
import { RecordsError } from "./records-error";

export function recordsErrorResponse(error: unknown) {
  if (error instanceof RecordsError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status },
    );
  }
  console.error("Records module request failed:", error);
  return NextResponse.json(
    { error: "The records operation could not be completed." },
    { status: 500 },
  );
}

export function requestMetadata(request: Request) {
  const forwarded = request.headers
    .get("x-forwarded-for")
    ?.split(",")[0]
    ?.trim();
  return {
    ipAddress:
      forwarded?.slice(0, 45) ??
      request.headers.get("x-real-ip")?.slice(0, 45) ??
      null,
    userAgent: request.headers.get("user-agent")?.slice(0, 500) ?? null,
  };
}
