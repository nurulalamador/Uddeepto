import { NextResponse } from "next/server";
import { readBackendBody } from "../../../../lib/backend";
import { clearAuthCookies, fetchBackendWithAuth, hasSessionCookie } from "../../../../lib/server-auth";

export async function GET() {
  if (!(await hasSessionCookie())) {
    return NextResponse.json({ error: { message: "Unauthenticated" } }, { status: 401 });
  }

  try {
    const response = await fetchBackendWithAuth("/api/auth/me");
    const data = await readBackendBody(response);

    if (!response.ok) {
      if (response.status === 401) await clearAuthCookies();
      return NextResponse.json(data || { error: { message: "Unauthenticated" } }, { status: response.status });
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: { message: "Backend is unavailable" } }, { status: 502 });
  }
}
