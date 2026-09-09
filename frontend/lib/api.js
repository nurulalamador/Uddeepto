let refreshing;
async function renew(){if(!refreshing)refreshing=fetch('/api/auth/refresh',{method:'POST'}).finally(()=>{refreshing=null;});return refreshing;}
export async function api(path,options={},retry=true){
  const form=options.body instanceof FormData;
  const r=await fetch(`/api/backend/${path}`,{...options,headers:{...(form?{}:{'Content-Type':'application/json'}),...options.headers},body:options.body===undefined?undefined:form?options.body:JSON.stringify(options.body)});
  if(r.status===401&&retry){const refresh=await renew();if(refresh.ok)return api(path,options,false);window.location.assign('/login');throw new Error('Session expired. Please sign in again.');}
  if(r.status===204)return null;
  const data=await r.json().catch(()=>({error:'Unexpected server response'}));
  if(!r.ok)throw new Error(data.error||`Request failed (${r.status})`);return data;
}
