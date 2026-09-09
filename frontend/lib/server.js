import 'server-only';
import { cookies } from 'next/headers';
export const backend = () => (process.env.BACKEND_URL || 'http://localhost:4000/api/v1').replace(/\/$/, '');
export const cookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/' };
export async function currentUser() {
  const jar = await cookies(); const token = jar.get('ud_access')?.value;
  if (!token) return null;
  try { const r = await fetch(`${backend()}/users/me`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', signal: AbortSignal.timeout(15000) }); return r.ok ? await r.json() : null; } catch { return null; }
}
export function checkOrigin(request) {
  const origin = request.headers.get('origin');
  return origin === (process.env.APP_ORIGIN || new URL(request.url).origin);
}
