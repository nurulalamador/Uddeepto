import 'server-only';
import { cookies } from 'next/headers';
export const backend = () => (process.env.BACKEND_URL || 'http://localhost:4000/api/v1').replace(/\/$/, '');
export const cookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/' };
export async function refreshSession(jar) {
  const refreshToken = jar.get('ud_refresh')?.value;
  if (!refreshToken) return null;
  try {
    const response = await fetch(`${backend()}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) return null;
    const tokens = await response.json();
    jar.set('ud_access', tokens.accessToken, { ...cookieOptions, maxAge: 30 * 86400 });
    jar.set('ud_refresh', tokens.refreshToken, { ...cookieOptions, maxAge: 30 * 86400 });
    return tokens.accessToken;
  } catch {
    return null;
  }
}
export async function currentUser({ refresh = false } = {}) {
  const jar = await cookies(); let token = jar.get('ud_access')?.value;
  if (!token && refresh) token = await refreshSession(jar);
  if (!token) return null;
  try {
    let accessToken = token;
    let response = await fetch(`${backend()}/users/me`, { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store', signal: AbortSignal.timeout(15000) });
    if (response.status === 401 && refresh) {
      accessToken = await refreshSession(jar);
      if (!accessToken) return null;
      response = await fetch(`${backend()}/users/me`, { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store', signal: AbortSignal.timeout(15000) });
    }
    return response.ok ? await response.json() : null;
  } catch { return null; }
}
export function checkOrigin(request) {
  const origin = request.headers.get('origin');
  return origin === (process.env.APP_ORIGIN || new URL(request.url).origin);
}
