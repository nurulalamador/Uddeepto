import { cookies } from 'next/headers';
import { backend, checkOrigin, refreshSession } from '@/lib/server';
const roots = new Set(['users','courses','showcase','contests','webinars','communities','jobs','messages','payments','frontend']);
async function proxy(request,{params}) {
  if (!['GET','HEAD'].includes(request.method) && !checkOrigin(request)) return Response.json({error:'Invalid origin'},{status:403});
  const {path} = await params;
  if (!roots.has(path[0]) || path.some(p=>!/^[-\w.]+$/.test(p) || p==='..')) return Response.json({error:'Not found'},{status:404});
  const jar = await cookies();
  let token = jar.get('ud_access')?.value;
  if (!token) return Response.json({error:'Please sign in'},{status:401});
  try {
    const body = ['GET','HEAD'].includes(request.method) ? undefined : await request.arrayBuffer();
    if (body?.byteLength > 11*1024*1024) return Response.json({error:'File is too large'},{status:413});
    const target = `${backend()}/${path.map(encodeURIComponent).join('/')}${new URL(request.url).search}`;
    const headers = {Authorization:`Bearer ${token}`}; if(request.headers.get('content-type')) headers['Content-Type']=request.headers.get('content-type');
    let r = await fetch(target,{method:request.method,headers,body,cache:'no-store',signal:AbortSignal.timeout(25000)});
    if(r.status===401){const refreshed=await refreshSession(jar);if(refreshed){token=refreshed;headers.Authorization=`Bearer ${token}`;r=await fetch(target,{method:request.method,headers,body,cache:'no-store',signal:AbortSignal.timeout(25000)});}}
    const out = new Headers({'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
    for(const name of ['content-type','content-disposition']) if(r.headers.get(name))out.set(name,r.headers.get(name));
    const contentType=r.headers.get('content-type')||'';
    const inlineMedia=/^(image|audio|video)\//i.test(contentType);
    if(!contentType.includes('application/json')&&!inlineMedia&&!out.has('Content-Disposition'))out.set('Content-Disposition','attachment; filename="download"');
    return new Response(r.status===204?null:r.body,{status:r.status,headers:out});
  }catch{return Response.json({error:'Cannot reach the backend. Please try again.'},{status:502});}
}
export {proxy as GET,proxy as POST,proxy as PUT,proxy as PATCH,proxy as DELETE};
