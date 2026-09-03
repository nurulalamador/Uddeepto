import { NextResponse } from "next/server";

const protectedPrefixes = ["/dashboard", "/courses", "/contests", "/communities", "/jobs"];
const authPages = ["/login", "/signup"];

export function proxy(request) {
  const { pathname } = request.nextUrl;
  const hasSession = Boolean(
    request.cookies.get("access_token")?.value || request.cookies.get("refresh_token")?.value,
  );

  const isProtected = protectedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

  if (isProtected && !hasSession) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  if (hasSession && authPages.includes(pathname)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/courses/:path*",
    "/contests/:path*",
    "/communities/:path*",
    "/jobs/:path*",
    "/login",
    "/signup",
  ],
};
