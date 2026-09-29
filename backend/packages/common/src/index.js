import dotenv from 'dotenv';
import {fileURLToPath} from 'node:url';
dotenv.config({path:fileURLToPath(new URL('../../../.env',import.meta.url))});
import pg from 'pg';
import jwt from 'jsonwebtoken';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import { ZodError } from 'zod';

const { Pool } = pg;
export const pool = new Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.DATABASE_SSL==='false'?false:{rejectUnauthorized:false},max:10,idleTimeoutMillis:30000});
export const query=(text,params=[])=>pool.query(text,params);
export async function tx(fn){const c=await pool.connect();try{await c.query('BEGIN');const r=await fn(c);await c.query('COMMIT');return r}catch(e){await c.query('ROLLBACK');throw e}finally{c.release()}}
export class ApiError extends Error{constructor(status,message,details){super(message);this.status=status;this.details=details}}
export const asyncHandler=fn=>(req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next);
export function createApp(name){const app=express();app.disable('x-powered-by');app.use(helmet());app.use(express.json({limit:'1mb'}));app.use(express.urlencoded({extended:false}));app.use(rateLimit({windowMs:60000,limit:300,standardHeaders:'draft-7'}));app.get('/health',asyncHandler(async(_q,r)=>{await query('SELECT 1');r.json({service:name,status:'ok'})}));return app}
export function signAccess(user){return jwt.sign({sub:user.id,role:user.role,type:'access'},must('JWT_ACCESS_SECRET'),{expiresIn:process.env.ACCESS_TOKEN_TTL||'15m',issuer:'uddeepto'})}
export function signRefresh(user){return jwt.sign({sub:user.id,type:'refresh',nonce:crypto.randomUUID()},must('JWT_REFRESH_SECRET'),{expiresIn:process.env.REFRESH_TOKEN_TTL||'30d',issuer:'uddeepto'})}
export function verifyAccess(token){return jwt.verify(token,must('JWT_ACCESS_SECRET'),{issuer:'uddeepto'})}
export function verifyRefresh(token){return jwt.verify(token,must('JWT_REFRESH_SECRET'),{issuer:'uddeepto'})}
function must(k){if(!process.env[k])throw new Error(`${k} is required`);return process.env[k]}
export function auth(required=true){return asyncHandler(async(req,_res,next)=>{const h=req.headers.authorization;if(!h?.startsWith('Bearer ')){if(required)throw new ApiError(401,'Authentication required');return next();}let token;try{token=verifyAccess(h.slice(7));}catch{throw new ApiError(401,'Invalid or expired token');}if(token.type!=='access')throw new ApiError(401,'Invalid token type');const u=(await query("SELECT id,role,account_status FROM users WHERE id=$1",[token.sub])).rows[0];if(!u||u.account_status!=='active')throw new ApiError(401,'Account inactive');req.user={...token,role:u.role};next();});}
export const allow=(...roles)=>(req,_res,next)=>roles.includes(req.user?.role)?next():next(new ApiError(403,'Insufficient permission'));
export const validate=schema=>(req,_res,next)=>{try{req.body=schema.parse(req.body);next()}catch(e){next(e)}};
export const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:Number(process.env.MAX_UPLOAD_MB||10)*1024*1024}});
export function page(req){const limit=Math.min(Math.max(Number(req.query.limit)||20,1),100);const offset=Math.max(Number(req.query.offset)||0,0);return{limit,offset}}
export const publicUser=`id,name,email,username,role,bio,account_status,email_verified_at,last_login_at,created_at,updated_at`;
export function errors(err,_req,res,_next){console.error(err);if(err instanceof ZodError)return res.status(422).json({error:'Validation failed',details:err.flatten()});if(err.code==='23505')return res.status(409).json({error:'Already exists',details:err.detail});if(err.code==='23503')return res.status(409).json({error:'Referenced record does not exist or is in use'});if(err.code==='22P02')return res.status(400).json({error:'Invalid identifier or value'});if(err instanceof multer.MulterError)return res.status(413).json({error:err.message});res.status(err.status||500).json({error:err.status?err.message:'Internal server error',details:err.details})}
export function notFound(req,res){res.status(404).json({error:`Route not found: ${req.method} ${req.originalUrl}`})}
export function listen(app,port,name){app.use(notFound,errors);app.listen(port,()=>console.log(`${name} listening on ${port}`))}
export const pick=(obj,keys)=>Object.fromEntries(keys.filter(k=>obj[k]!==undefined).map(k=>[k,obj[k]]));
export async function updateRow(table,id,data,allowed,extraWhere='',extra=[]){const clean=pick(data,allowed);const keys=Object.keys(clean);if(!keys.length)throw new ApiError(400,'No valid fields supplied');const sets=keys.map((k,i)=>`${k}=$${i+1}`).join(',');const values=keys.map(k=>clean[k]);const r=await query(`UPDATE ${table} SET ${sets} WHERE id=$${keys.length+1} ${extraWhere} RETURNING *`,[...values,id,...extra]);if(!r.rowCount)throw new ApiError(404,'Record not found');return r.rows[0]}
export async function platformSetting(key,fallback){const exists=(await query("SELECT to_regclass('public.platform_settings') IS NOT NULL present")).rows[0]?.present;if(!exists)return fallback;const setting=(await query('SELECT value FROM platform_settings WHERE key=$1',[key])).rows[0];return setting?setting.value:fallback}
export function resourceRouter({table,fields,required=[],owner='creator_id',publicWhere='',createRoles=[],writeRoles=[],search=[],adminOnlyFields=[],adminOnlyWrites=false}){const r=express.Router();
 r.get('/',auth(false),asyncHandler(async(req,res)=>{const{limit,offset}=page(req);const vals=[];let where=publicWhere?`WHERE ${publicWhere}`:'';if(req.query.q&&search.length){vals.push(`%${req.query.q}%`);where+=`${where?' AND':'WHERE'} (${search.map(f=>`${f} ILIKE $${vals.length}`).join(' OR ')})`}vals.push(limit,offset);res.json((await query(`SELECT * FROM ${table} ${where} ORDER BY created_at DESC LIMIT $${vals.length-1} OFFSET $${vals.length}`,vals)).rows)}));
 r.get('/:id',auth(false),asyncHandler(async(req,res)=>{const x=(await query(`SELECT * FROM ${table} WHERE id=$1`,[req.params.id])).rows[0];if(!x)throw new ApiError(404,'Record not found');res.json(x)}));
 r.post('/',auth(),...(createRoles.length?[allow(...createRoles)]:[]),asyncHandler(async(req,res)=>{for(const k of required)if(req.body[k]===undefined)throw new ApiError(422,`${k} is required`);const needsReview=adminOnlyFields.length&&await platformSetting('content_review_required',true);const writable=req.user.role==='admin'||!needsReview?fields:fields.filter(k=>!adminOnlyFields.includes(k));const data=pick(req.body,writable);if(owner)data[owner]=req.user.sub;const keys=Object.keys(data),vals=Object.values(data);const x=(await query(`INSERT INTO ${table}(${keys.join(',')}) VALUES(${keys.map((_,i)=>`$${i+1}`).join(',')}) RETURNING *`,vals)).rows[0];res.status(201).json(x)}));
 r.patch('/:id',auth(),asyncHandler(async(req,res)=>{if(adminOnlyWrites&&req.user.role!=='admin')throw new ApiError(403,'Admin required');const privileged=[...writeRoles,'admin','moderator'].includes(req.user.role);if(owner&&!privileged){const owned=await query(`SELECT 1 FROM ${table} WHERE id=$1 AND ${owner}=$2`,[req.params.id,req.user.sub]);if(!owned.rowCount)throw new ApiError(404,'Record not found or not owned by you')}const needsReview=adminOnlyFields.length&&await platformSetting('content_review_required',true);const writable=req.user.role==='admin'||!needsReview?fields:fields.filter(k=>!adminOnlyFields.includes(k));res.json(await updateRow(table,req.params.id,req.body,writable))}));
 r.delete('/:id',auth(),asyncHandler(async(req,res)=>{if(adminOnlyWrites&&req.user.role!=='admin')throw new ApiError(403,'Admin required');const privileged=[...writeRoles,'admin','moderator'].includes(req.user.role);const vals=[req.params.id];let w='id=$1';if(owner&&!privileged){vals.push(req.user.sub);w+=` AND ${owner}=$2`}const x=await query(`DELETE FROM ${table} WHERE ${w}`,vals);if(!x.rowCount)throw new ApiError(404,'Record not found or not owned by you');res.status(204).end()}));return r}
