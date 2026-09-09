import { cookies } from 'next/headers';
import { backend, cookieOptions, checkOrigin, currentUser } from '@/lib/server';
export async function GET(_request, { params }) {
  if ((await params).action !== 'me') return Response.json({error:'Not found'}, {status:404});
  const user = await currentUser(); return Response.json({user}, {status:user ? 200 : 401});
}
export async function POST(request, { params }) {
  if (!checkOrigin(request)) return Response.json({error:'Invalid origin'}, {status:403});
  const {action} = await params; const jar = await cookies();
  if (!['login','register','refresh','logout'].includes(action)) return Response.json({error:'Not found'}, {status:404});
  let body;
  try { body = ['refresh','logout'].includes(action) ? { refreshToken: jar.get('ud_refresh')?.value || '' } : await request.json(); } catch { return Response.json({error:'Invalid request'}, {status:400}); }
  if (action === 'register') body.role = body.role === 'hirer' ? 'hirer' : 'learner';
  try {
    const r = await fetch(`${backend()}/auth/${action}`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store',signal:AbortSignal.timeout(20000)});
    const data = r.status === 204 ? {} : await r.json();
    if (action === 'logout') { jar.delete('ud_access'); jar.delete('ud_refresh'); return Response.json({ok:true}); }
    if (!r.ok) return Response.json(data,{status:r.status});
    jar.set('ud_access',data.accessToken,{...cookieOptions,maxAge:30*86400});
    jar.set('ud_refresh',data.refreshToken,{...cookieOptions,maxAge:30*86400});
    return Response.json({user:data.user || null,ok:true});
  } catch {
    if(action==='logout'){jar.delete('ud_access');jar.delete('ud_refresh');return Response.json({ok:true});}
    return Response.json({error:'Backend unavailable. Check BACKEND_URL and start the backend services.'},{status:502});
  }
}
