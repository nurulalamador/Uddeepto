import { cookies } from 'next/headers';
import { backend, checkOrigin, refreshSession } from '@/lib/server';
const roots = new Set(['users','courses','showcase','contests','webinars','communities','jobs','messages','payments','frontend']);
const MAX_UPLOAD_BYTES = 600*1024*1024; // course-material uploads are streamed straight to the backend
const isMaterialUpload = (method, path) => method === 'POST' && path[0] === 'frontend' && ((path[1] === 'manage' && path[2] === 'courses' && path[4] === 'materials' && path.length === 5) || (path[1] === 'contests' && path[3] === 'submit' && path.length === 4));
const isMaterialFile = (method, path) => method === 'GET' && path[0] === 'frontend' && ((path[1] === 'courses' && path[3] === 'materials' && path[5] === 'file') || (path[1] === 'contests' && path[3] === 'submissions' && path[5] === 'file'));
async function proxy(request,{params}) {
  if (!['GET','HEAD'].includes(request.method) && !checkOrigin(request)) return Response.json({error:'Invalid origin'},{status:403});
  const {path} = await params;
  if (!roots.has(path[0]) || path.some(p=>!/^[-\w.]+$/.test(p) || p==='..')) return Response.json({error:'Not found'},{status:404});
  const jar = await cookies();
  let token = jar.get('ud_access')?.value;
  if (!token) return Response.json({error:'Please sign in'},{status:401});
  try {
    const streamUpload = isMaterialUpload(request.method, path);
    const longRequest = streamUpload || isMaterialFile(request.method, path);
    const aiRequest = path[0] === 'frontend' && path[1] === 'ai';
    const timeout = () => AbortSignal.timeout(longRequest ? 30*60*1000 : aiRequest ? 70000 : 25000);
    if (streamUpload && Number(request.headers.get('content-length')||0) > MAX_UPLOAD_BYTES) return Response.json({error:'File is too large'},{status:413});
    const body = ['GET','HEAD'].includes(request.method) || streamUpload ? undefined : await request.arrayBuffer();
    if (body?.byteLength > 11*1024*1024) return Response.json({error:'File is too large'},{status:413});
    const target = `${backend()}/${path.map(encodeURIComponent).join('/')}${new URL(request.url).search}`;
    const headers = {Authorization:`Bearer ${token}`}; if(request.headers.get('content-type')) headers['Content-Type']=request.headers.get('content-type');
    for(const name of ['range','if-range']) if(request.headers.get(name)) headers[name]=request.headers.get(name);
    const init = () => streamUpload ? {method:request.method,headers,body:request.body,duplex:'half',cache:'no-store',signal:timeout()} : {method:request.method,headers,body,cache:'no-store',signal:timeout()};
    let r = await fetch(target,init());
    // A streamed body can only be sent once, so uploads rely on the client's own refresh-and-retry.
    if(r.status===401 && !streamUpload){const refreshed=await refreshSession(jar);if(refreshed){token=refreshed;headers.Authorization=`Bearer ${token}`;r=await fetch(target,init());}}
    const out = new Headers({'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
    for(const name of ['content-type','content-disposition','content-range','accept-ranges','content-length']) if(r.headers.get(name))out.set(name,r.headers.get(name));
    const contentType=r.headers.get('content-type')||'';
    const inlineMedia=/^(image|audio|video)\//i.test(contentType);
    if(!contentType.includes('application/json')&&!inlineMedia&&!out.has('Content-Disposition'))out.set('Content-Disposition','attachment; filename="download"');
    return new Response(r.status===204?null:r.body,{status:r.status,headers:out});
  }catch{return Response.json({error:'Cannot reach the backend. Please try again.'},{status:502});}
}
export {proxy as GET,proxy as POST,proxy as PUT,proxy as PATCH,proxy as DELETE};
