const BACKEND_API_URL = (process.env.BACKEND_API_URL || "http://localhost:8080").replace(/\/$/, "");

export async function backendRequest(path, options = {}) {
  const headers = new Headers(options.headers || {});

  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return fetch(`${BACKEND_API_URL}${path}`, {
    ...options,
    headers,
    cache: "no-store",
  });
}

export async function readBackendBody(response) {
  if (response.status === 204) return null;

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json().catch(() => ({}));
  }

  const text = await response.text();
  return text ? { message: text } : {};
}
