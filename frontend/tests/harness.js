// Isolated test-only adapter. Never imported by the app or included backend service.
import {PGlite}from'@electric-sql/pglite';import express from'express';
export const db=new PGlite();export const query=(sql,args=[])=>db.query(sql,args).then(r=>({...r,rowCount:r.rows.length||r.affectedRows||0}));
export async function tx(fn){await query('BEGIN');try{const result=await fn({query});await query('COMMIT');return result;}catch(e){await query('ROLLBACK');throw e;}}
export class ApiError extends Error{constructor(status,message){super(message);this.status=status;}}
export const asyncHandler=fn=>(q,s,n)=>Promise.resolve(fn(q,s,n)).catch(n);
export function createApp(){const app=express();app.use(express.json());return app;}
export const auth=()=>((q,_s,n)=>{q.user={sub:q.headers['x-test-user']};n();});
export const allow=()=>((_q,_s,n)=>n());
export let server;
export function listen(app){app.use((e,_q,s,_n)=>s.status(e.status||500).json({error:e.message}));server=app.listen(0,'127.0.0.1');}
