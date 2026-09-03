import { cookies } from "next/headers";
import { backendRequest } from "./backend";

export const ACCESS_COOKIE = "access_token";
export const REFRESH_COOKIE = "refresh_token";

function cookieBaseOptions() {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };
}

export async function setAuthCookies(tokens) {
  const store = await cookies();
  const accessMaxAge = Number(process.env.AUTH_ACCESS_COOKIE_MAX_AGE || 15 * 60);
  const refreshMaxAge = Number(process.env.AUTH_REFRESH_COOKIE_MAX_AGE || 30 * 24 * 60 * 60);

  store.set(ACCESS_COOKIE, tokens.accessToken, {
    ...cookieBaseOptions(),
    maxAge: accessMaxAge,
  });

  store.set(REFRESH_COOKIE, tokens.refreshToken, {
    ...cookieBaseOptions(),
    maxAge: refreshMaxAge,
  });
}

export async function clearAuthCookies() {
  const store = await cookies();
  store.set(ACCESS_COOKIE, "", { ...cookieBaseOptions(), maxAge: 0 });
  store.set(REFRESH_COOKIE, "", { ...cookieBaseOptions(), maxAge: 0 });
}

export async function getRefreshToken() {
  const store = await cookies();
  return store.get(REFRESH_COOKIE)?.value || null;
}

export async function hasSessionCookie() {
  const store = await cookies();
  return Boolean(store.get(ACCESS_COOKIE)?.value || store.get(REFRESH_COOKIE)?.value);
}

async function refreshTokens() {
  const store = await cookies();
  const refreshToken = store.get(REFRESH_COOKIE)?.value;
  if (!refreshToken) return null;

  const response = await backendRequest("/api/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refreshToken }),
  });

  if (!response.ok) {
    await clearAuthCookies();
    return null;
  }

  const data = await response.json();
  if (!data?.tokens?.accessToken || !data?.tokens?.refreshToken) {
    await clearAuthCookies();
    return null;
  }

  await setAuthCookies(data.tokens);
  return data.tokens.accessToken;
}

export async function fetchBackendWithAuth(path, options = {}) {
  const store = await cookies();
  let accessToken = store.get(ACCESS_COOKIE)?.value || null;

  if (!accessToken) {
    accessToken = await refreshTokens();
  }

  const makeRequest = (token) => {
    const headers = new Headers(options.headers || {});
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return backendRequest(path, { ...options, headers });
  };

  let response = await makeRequest(accessToken);

  if (response.status === 401) {
    const refreshedAccessToken = await refreshTokens();
    if (refreshedAccessToken) {
      response = await makeRequest(refreshedAccessToken);
    }
  }

  return response;
}
