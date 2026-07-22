import { NextResponse, type NextRequest } from "next/server";

type Role = "chairman" | "bookkeeper" | "member";

const roleHomePaths: Record<Role, string> = {
  chairman: "/portal/chairman/dashboard",
  bookkeeper: "/portal/bookkeeper/dashboard",
  member: "/portal/member/dashboard",
};

const landingPaths = new Set([
  "/",
  "/login",
  "/portal",
  "/about/our-cooperative",
  "/about/board-of-directors",
  "/announcements",
  "/gallery",
  "/contact",
]);

type AuthPayload = {
  success: boolean;
  data?: {
    role?: string;
  };
};

function loginRedirect(request: NextRequest) {
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

function roleForPath(pathname: string): Role | null {
  if (
    pathname.startsWith("/portal/chairman") ||
    pathname.startsWith("/chairman") ||
    pathname.startsWith("/chairman_dashboard") ||
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/members")
  ) {
    return "chairman";
  }

  if (
    pathname.startsWith("/portal/bookkeeper") ||
    pathname.startsWith("/bookkeeper") ||
    pathname.startsWith("/bookkeeper_dashboard")
  ) {
    return "bookkeeper";
  }

  if (pathname.startsWith("/portal/member") || pathname.startsWith("/member_dashboard")) {
    return "member";
  }

  return null;
}

function canonicalPath(pathname: string, role: Role) {
  if (pathname.startsWith(`/portal/${role}`)) return pathname;
  if (pathname.startsWith(`/${role}/`)) return `/portal/${role}${pathname.slice(role.length + 1)}`;
  if (pathname === `/${role}`) return `/portal/${role}/dashboard`;
  if (pathname.startsWith("/chairman_dashboard")) return "/portal/chairman/dashboard";
  if (pathname.startsWith("/bookkeeper_dashboard")) return "/portal/bookkeeper/dashboard";
  if (pathname.startsWith("/member_dashboard")) return "/portal/member/dashboard";
  if (pathname.startsWith("/dashboard")) return "/portal/chairman/dashboard";
  if (pathname.startsWith("/members")) return `/portal/chairman${pathname}`;
  return roleHomePaths[role];
}

function internalPath(pathname: string) {
  if (pathname.startsWith("/portal/chairman")) {
    const suffix = pathname.slice("/portal/chairman".length);
    return `/chairman${suffix || "/dashboard"}`;
  }

  if (pathname.startsWith("/portal/bookkeeper")) {
    const suffix = pathname.slice("/portal/bookkeeper".length);
    return `/bookkeeper${suffix || "/dashboard"}`;
  }

  if (pathname.startsWith("/portal/member")) {
    return "/member_dashboard";
  }

  return pathname;
}

function isRole(value: string | undefined): value is Role {
  return value === "chairman" || value === "bookkeeper" || value === "member";
}

async function getSessionRole(request: NextRequest, cookieName: string) {
  const token = request.cookies.get(cookieName)?.value;

  if (!token) {
    return null;
  }

  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";
    const response = await fetch(`${apiUrl}/api/auth/me`, {
      cache: "no-store",
      headers: {
        cookie: `${cookieName}=${encodeURIComponent(token)}`,
      },
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as AuthPayload;
    const role = payload.success ? payload.data?.role : undefined;
    return isRole(role) ? role : null;
  } catch {
    return null;
  }
}

export async function proxy(request: NextRequest) {
  const cookieName = process.env.SESSION_COOKIE_NAME ?? "trackcoop_session";
  const pathname = request.nextUrl.pathname;
  const expectedRole = roleForPath(pathname);
  const sessionRole = await getSessionRole(request, cookieName);

  if (!sessionRole) {
    return expectedRole ? loginRedirect(request) : NextResponse.next();
  }

  if (landingPaths.has(pathname)) {
    return NextResponse.redirect(new URL(roleHomePaths[sessionRole], request.url));
  }

  if (expectedRole && expectedRole !== sessionRole) {
    return NextResponse.redirect(new URL(roleHomePaths[sessionRole], request.url));
  }

  if (expectedRole) {
    const canonical = canonicalPath(pathname, expectedRole);

    if (pathname !== canonical) {
      return NextResponse.redirect(new URL(canonical, request.url));
    }

    const rewriteUrl = request.nextUrl.clone();
    rewriteUrl.pathname = internalPath(pathname);
    return NextResponse.rewrite(rewriteUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/portal/:path*",
    "/about/:path*",
    "/announcements/:path*",
    "/gallery/:path*",
    "/contact/:path*",
    "/chairman/:path*",
    "/bookkeeper/:path*",
    "/chairman_dashboard/:path*",
    "/bookkeeper_dashboard/:path*",
    "/member_dashboard/:path*",
    "/dashboard/:path*",
    "/members/:path*",
  ],
};
