// Isolated test-only adapter. Never imported by the app or included backend service.
import {PGlite}from'@electric-sql/pglite';import express from'express';
export const db=new PGlite();export const query=(sql,args=[])=>db.query(sql,args).then(r=>({...r,rowCount:r.rows.length||r.affectedRows||0}));
export async function tx(fn){await query('BEGIN');try{const result=await fn({query});await query('COMMIT');return result;}catch(e){await query('ROLLBACK');throw e;}}
export class ApiError extends Error{constructor(status,message){super(message);this.status=status;}}
export const asyncHandler=fn=>(q,s,n)=>Promise.resolve(fn(q,s,n)).catch(n);
export function createApp(){const app=express();app.use(express.json());return app;}
export const auth=()=>((q,_s,n)=>{q.user={sub:q.headers['x-test-user']};n();});
export const upload={array:()=>((q,_s,n)=>{const types=String(q.headers['x-test-media']||'').split(',').filter(Boolean);if(types.length)q.files=types.map((type,i)=>({mimetype:type,originalname:q.headers['x-test-media-name']?Buffer.from(decodeURIComponent(q.headers['x-test-media-name']),'utf8').toString('latin1'):`file-${i}.bin`,buffer:Buffer.from(`media-${i}`),size:7}));n();}),single:()=>((q,_s,n)=>{if(q.headers['x-test-upload'])q.file={mimetype:q.headers['x-test-upload'],buffer:Buffer.from('test-image-bytes'),size:17};n();}),fields:()=>((q,_s,n)=>{q.files={};if(q.headers['x-test-upload'])for(const field of (q.headers['x-test-upload-field']||'').split(',').filter(Boolean))q.files[field]=[{mimetype:q.headers['x-test-upload'],buffer:Buffer.from('test-image-bytes'),size:17}];n();})};
import fs from 'node:fs';import path from 'node:path';
export const multer=Object.assign(()=>({single:()=>((q,_s,n)=>{const type=q.headers['x-test-material']||q.headers['x-test-submission'];if(type){const name=q.headers['x-test-filename']||'file.bin';const dir=path.join(process.env.UPLOAD_DIR,q.headers['x-test-submission']?'contest-submissions':'course-materials',q.contest?.id||q.params.id);fs.mkdirSync(dir,{recursive:true});const filename=crypto.randomUUID()+path.extname(name);const body=Buffer.from('0123456789abcdef');fs.writeFileSync(path.join(dir,filename),body);q.file={mimetype:type,originalname:name,filename,path:path.join(dir,filename),size:body.length};}n();})}),{diskStorage:()=>({})});
export const allow=()=>((_q,_s,n)=>n());
export const page=req=>({limit:Math.min(Math.max(Number(req.query.limit)||20,1),100),offset:Math.max(Number(req.query.offset)||0,0)});
export const resourceRouter=()=>express.Router();
export let server;export const servers=[];
export function listen(app){app.use((e,_q,s,_n)=>s.status(e.status||(e.name==='ZodError'?422:500)).json({error:e.message}));server=app.listen(0,'127.0.0.1');servers.push(server);return server;}
// The real notification code, run against the in-memory database.
import{createNotifier,NOTIFICATION_TYPES}from'../../backend/packages/common/src/notifications.js';
export{NOTIFICATION_TYPES};
// Live updates: the real emit code and the real socket server, run against the in-memory database.
import{emit,emitBatch,emitLocal,leaveRoom,userRoom,verifyInternalToken}from'../../backend/packages/common/src/realtime.js';import{createRealtime}from'../../backend/packages/common/src/realtime-server.js';
export{emit,emitBatch,emitLocal,leaveRoom,userRoom,verifyInternalToken};
export const attachRealtime=(httpServer,options)=>createRealtime(httpServer,options);
export const signSocketTicket=user=>String(user.id);export const verifySocketTicket=ticket=>{if(!ticket)throw new Error('missing ticket');return{sub:ticket};};
export const{notify,unnotify,notifyAdmins,notifyInterested,notifyApplicationStatus}=createNotifier(query,items=>emitBatch(items.map(item=>({rooms:[userRoom(item.to)],event:item.event,payload:item.payload}))));
// Used by the auth module.
export const validate=schema=>(q,_s,n)=>{try{q.body=schema.parse(q.body);n();}catch(e){n(e);}};export const signAccess=()=>'access-token';export const signRefresh=()=>'refresh-'+Math.random();export const verifyRefresh=()=>({exp:Math.floor(Date.now()/1000)+3600});export const publicUser='id,name,email,username,role';export const platformSetting=async(_key,fallback)=>fallback;
