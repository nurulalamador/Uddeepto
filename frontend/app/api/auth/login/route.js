import { NextResponse } from "next/server";
import { backendRequest, readBackendBody } from "../../../../lib/backend";
import { setAuthCookies } from "../../../../lib/server-auth";

export async function POST(request) {
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: { message: "Invalid request body" } }, { status: 400 });
  }

  try {
    const response = await backendRequest("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(body),
    });
    const data = await readBackendBody(response);

    if (!response.ok) {
      return NextResponse.json(data || { error: { message: "Login failed" } }, { status: response.status });
    }

    await setAuthCookies(data.tokens);
    return NextResponse.json({ user: data.user });
  } catch {
    return NextResponse.json({ error: { message: "Backend is unavailable" } }, { status: 502 });
  }
}
