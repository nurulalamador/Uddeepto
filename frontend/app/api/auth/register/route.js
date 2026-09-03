import { NextResponse } from "next/server";
import { backendRequest, readBackendBody } from "../../../../lib/backend";
import { setAuthCookies } from "../../../../lib/server-auth";

export async function POST(request) {
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: { message: "Invalid request body" } }, { status: 400 });
  }

  try {
    const response = await backendRequest("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(body),
    });
    const data = await readBackendBody(response);

    if (!response.ok) {
      console.error("Backend registration rejected:", {
        status: response.status,
        error: data?.error ?? data,
      });

      return NextResponse.json(
        data || { error: { message: "Registration failed" } },
        { status: response.status }
      );
    }

    await setAuthCookies(data.tokens);

    return NextResponse.json(
      { user: data.user },
      { status: 201 }
    );

  } catch (error) {
    console.error("Registration proxy error:", error);

    return NextResponse.json(
      {
        error: {
          message: "Backend is unavailable",
        },
      },
      { status: 502 }
    );
  }
}
