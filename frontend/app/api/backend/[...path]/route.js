import { NextResponse } from "next/server";
import { readBackendBody } from "../../../../lib/backend";
import { fetchBackendWithAuth, hasSessionCookie } from "../../../../lib/server-auth";

const ALLOWED_ROOTS = new Set(["users", "courses", "jobs", "contests", "communities"]);

async function handler(request, context) {
  if (!(await hasSessionCookie())) {
    return NextResponse.json({ error: { message: "Unauthenticated" } }, { status: 401 });
  }

  const { path = [] } = await context.params;
  const [root] = path;

  if (!root || !ALLOWED_ROOTS.has(root)) {
    return NextResponse.json({ error: { message: "Backend route is not allowed" } }, { status: 404 });
  }

  const incomingUrl = new URL(request.url);
  const backendPath = `/api/${path.join("/")}${incomingUrl.search}`;
  const method = request.method;
  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);

  let body;
  if (!["GET", "HEAD"].includes(method)) {
    const raw = await request.text();
    if (raw) body = raw;
  }

  try {
    const response = await fetchBackendWithAuth(backendPath, { method, headers, body });
    const data = await readBackendBody(response);

    if (response.status === 204) {
      return new NextResponse(null, { status: 204 });
    }

    return NextResponse.json(data || {}, { status: response.status });
  } catch {
    return NextResponse.json({ error: { message: "Backend is unavailable" } }, { status: 502 });
  }
}

export const GET = handler;
export const POST = handler;
export const PATCH = handler;
export const PUT = handler;
export const DELETE = handler;
