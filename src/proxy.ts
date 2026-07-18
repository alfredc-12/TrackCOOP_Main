import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const cookieName = process.env.SESSION_COOKIE_NAME ?? "trackcoop_session";

  if (!request.cookies.has(cookieName)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/portal/:path*",
    "/chairman/:path*",
    "/bookkeeper/:path*",
    "/chairman_dashboard/:path*",
    "/bookkeeper_dashboard/:path*",
    "/member_dashboard/:path*",
    "/dashboard/:path*",
    "/members/:path*",
  ],
};
