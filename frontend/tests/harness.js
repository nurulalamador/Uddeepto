// Isolated test-only adapter. Never imported by the app or included backend service.
import {PGlite}from'@electric-sql/pglite';import express from'express';
export const db=new PGlite();export const query=(sql,args=[])=>db.query(sql,args).then(r=>({...r,rowCount:r.rows.length||r.affectedRows||0}));
export async function tx(fn){await query('BEGIN');try{const result=await fn({query});await query('COMMIT');return result;}catch(e){await query('ROLLBACK');throw e;}}
export class ApiError extends Error{constructor(status,message){super(message);this.status=status;}}
export const asyncHandler=fn=>(q,s,n)=>Promise.resolve(fn(q,s,n)).catch(n);
export function createApp(){const app=express();app.use(express.json());return app;}
export const auth=()=>((q,_s,n)=>{q.user={sub:q.headers['x-test-user']};n();});
export const upload={array:()=>((_q,_s,n)=>n()),single:()=>((q,_s,n)=>{if(q.headers['x-test-upload'])q.file={mimetype:q.headers['x-test-upload'],buffer:Buffer.from('test-image-bytes'),size:17};n();}),fields:()=>((q,_s,n)=>{q.files={};if(q.headers['x-test-upload'])for(const field of (q.headers['x-test-upload-field']||'').split(',').filter(Boolean))q.files[field]=[{mimetype:q.headers['x-test-upload'],buffer:Buffer.from('test-image-bytes'),size:17}];n();})};
export const allow=()=>((_q,_s,n)=>n());
export const page=req=>({limit:Math.min(Math.max(Number(req.query.limit)||20,1),100),offset:Math.max(Number(req.query.offset)||0,0)});
export const resourceRouter=()=>express.Router();
export let server;
export function listen(app){app.use((e,_q,s,_n)=>s.status(e.status||500).json({error:e.message}));server=app.listen(0,'127.0.0.1');}
