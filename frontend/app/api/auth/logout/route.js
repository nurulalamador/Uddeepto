import { NextResponse } from "next/server";
import { backendRequest } from "../../../../lib/backend";
import { clearAuthCookies, getRefreshToken } from "../../../../lib/server-auth";

export async function POST() {
  const refreshToken = await getRefreshToken();

  try {
    if (refreshToken) {
      await backendRequest("/api/auth/logout", {
        method: "POST",
        body: JSON.stringify({ refreshToken }),
      });
    }
  } catch {
    // Local logout should still succeed even if the backend is temporarily unavailable.
  }

  await clearAuthCookies();
  return new NextResponse(null, { status: 204 });
}
