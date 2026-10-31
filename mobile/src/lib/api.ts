import * as SecureStore from "expo-secure-store";
import { API_URL } from "./config";
import { sendMultipart, type ApiResponse } from "./multipart";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const ACCESS = "uddeepto.access";
const REFRESH = "uddeepto.refresh";

let access: string | null = null;
let refresh: string | null = null;
let onSignedOut: (() => void) | null = null;

/** Called once by the auth provider: what to do when the session can no longer be renewed. */
export function setSignedOutHandler(handler: () => void) {
  onSignedOut = handler;
}

export async function loadTokens() {
  access = await SecureStore.getItemAsync(ACCESS);
  refresh = await SecureStore.getItemAsync(REFRESH);
  return Boolean(refresh);
}
export async function saveTokens(next: { accessToken: string; refreshToken: string }) {
  access = next.accessToken;
  refresh = next.refreshToken;
  await SecureStore.setItemAsync(ACCESS, access);
  await SecureStore.setItemAsync(REFRESH, refresh);
}
export async function clearTokens() {
  access = null;
  refresh = null;
  await SecureStore.deleteItemAsync(ACCESS).catch(() => {});
  await SecureStore.deleteItemAsync(REFRESH).catch(() => {});
}
export const getRefreshToken = () => refresh;
export const getAccessToken = () => access;

async function parse(response: ApiResponse) {
  if (response.status === 204) return null;
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function messageOf(status: number, data: any) {
  if (data && typeof data === "object" && data.error) {
    if (data.error === "Validation failed" && data.details?.fieldErrors) {
      const first = Object.values(data.details.fieldErrors as Record<string, string[]>).flat()[0];
      if (first) return String(first);
    }
    return String(data.error);
  }
  if (status === 0) return "Cannot reach the server. Check your internet connection.";
  return `Request failed (${status})`;
}

let renewing: Promise<boolean> | null = null;
async function renew(): Promise<boolean> {
  if (!refresh) return false;
  renewing ??= (async () => {
    try {
      const response = await fetch(`${API_URL}/auth/refresh`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refreshToken: refresh }) });
      if (!response.ok) return false;
      const data = await response.json();
      await saveTokens(data);
      return true;
    } catch {
      return false;
    } finally {
      setTimeout(() => (renewing = null), 0);
    }
  })();
  return renewing;
}

type Options = { method?: string; body?: any; form?: FormData; auth?: boolean; signal?: AbortSignal };

/** Calls the API as the signed-in person. A 401 renews the session once and retries. */
export async function api<T = any>(path: string, options: Options = {}, retried = false): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.auth !== false && access) headers.Authorization = `Bearer ${access}`;
  let body: any;
  if (options.form) body = options.form;
  else if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }
  let response: ApiResponse;
  try {
    const url = `${API_URL}/${path.replace(/^\//, "")}`;
    response = options.form
      ? await sendMultipart(url, options.method || "GET", headers, options.form, options.signal)
      : await fetch(url, { method: options.method || "GET", headers, body, signal: options.signal });
  } catch (error: any) {
    if (error?.name === "AbortError") throw error;
    throw new ApiError(0, messageOf(0, null));
  }
  if (response.status === 401 && options.auth !== false && !retried && refresh) {
    if (await renew()) return api<T>(path, options, true);
    await clearTokens();
    onSignedOut?.();
    throw new ApiError(401, "Your session has ended. Please sign in again.");
  }
  const data = await parse(response);
  if (!response.ok) throw new ApiError(response.status, messageOf(response.status, data));
  return data as T;
}

/** A picture or file address on the API, for <Image> (the token travels in a header). */
export const fileUrl = (path: string) => `${API_URL}/${path.replace(/^\//, "")}`;
export const authHeaders = () => (access ? { Authorization: `Bearer ${access}` } : undefined);
