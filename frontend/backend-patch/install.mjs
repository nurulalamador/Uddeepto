// Run: node /path/to/backend-patch/install.mjs /path/to/uddeepto-backend
// Local source changes only. Never connects to or migrates a database.
import {readFile,writeFile,cp,access}from'node:fs/promises';import path from'node:path';import{fileURLToPath}from'node:url';
const root=path.resolve(process.argv[2]||'');
if(!process.argv[2])throw new Error('Pass the existing uddeepto-backend folder as the first argument');
const own=path.dirname(fileURLToPath(import.meta.url));
const packagePath=path.join(root,'package.json');const pkg=JSON.parse(await readFile(packagePath,'utf8'));
if(pkg.name!=='uddeepto-backend')throw new Error('Target must be the original uddeepto-backend project');
async function save(file,content){try{await access(file+'.before-frontend');}catch{await cp(file,file+'.before-frontend');}await writeFile(file,content);}
await cp(path.join(own,'services','frontend'),path.join(root,'services','frontend'),{recursive:true});
const gateway=path.join(root,'services/gateway/src/server.js');let source=await readFile(gateway,'utf8');
if(!source.includes("'/api/v1/frontend'")){
 const marker="app.use((_q,s)=>s.status(404)";
 if(!source.includes(marker))throw new Error('Gateway differs from the supplied version. Add the frontend proxy before its 404 handler manually.');
 source=source.replace(marker,"app.use('/api/v1/frontend',createProxyMiddleware({target:process.env.FRONTEND_API_URL||'http://localhost:4010',changeOrigin:true}));"+marker);
}
// Express mount paths are already stripped by http-proxy-middleware v3.
source=source.replace("pathRewrite:{[`^/api/v1/${path}`]:path==='showcase'?'/showcase':''}","pathRewrite:(url)=>path==='showcase'?'/showcase'+url:url");
await save(gateway,source);
for(const script of ['start','dev'])if(!pkg.scripts[script].includes('services/frontend'))pkg.scripts[script]+=` \"npm:${script} -w services/frontend\"`;
await save(packagePath,JSON.stringify(pkg,null,2)+'\n');
// Workspaces run from their own folders. Load the root .env explicitly.
const common=path.join(root,'packages/common/src/index.js');let shared=await readFile(common,'utf8');
shared=shared.replace("import 'dotenv/config';","import dotenv from 'dotenv';\nimport {fileURLToPath} from 'node:url';\ndotenv.config({path:fileURLToPath(new URL('../../../.env',import.meta.url))});");
// Validate current account state and role for every existing service as well.
const authStart=shared.indexOf('export function auth(required=true)');const authEnd=shared.indexOf('\nexport const allow=',authStart);
if(authStart>=0&&authEnd>authStart)shared=shared.slice(0,authStart)+`export function auth(required=true){return asyncHandler(async(req,_res,next)=>{const h=req.headers.authorization;if(!h?.startsWith('Bearer ')){if(required)throw new ApiError(401,'Authentication required');return next();}let token;try{token=verifyAccess(h.slice(7));}catch{throw new ApiError(401,'Invalid or expired token');}if(token.type!=='access')throw new ApiError(401,'Invalid token type');const u=(await query("SELECT id,role,account_status FROM users WHERE id=$1",[token.sub])).rows[0];if(!u||u.account_status!=='active')throw new ApiError(401,'Account inactive');req.user={...token,role:u.role};next();});}`+shared.slice(authEnd);
await save(common,shared);
source=source.replace("import'dotenv/config';","import dotenv from 'dotenv';import{fileURLToPath}from'node:url';dotenv.config({path:fileURLToPath(new URL('../../../.env',import.meta.url))});");
await writeFile(gateway,source);
const authFile=path.join(root,'services/auth/src/server.js');let authSource=await readFile(authFile,'utf8');
authSource=authSource.replace("if(!r.rowCount)throw new ApiError(401,'Refresh token revoked or expired');await query('UPDATE auth_refresh_tokens SET revoked_at=now() WHERE token_hash=$1',[h]);", "if(!r.rowCount||r.rows[0].account_status!=='active')throw new ApiError(401,'Refresh token revoked or account inactive');const consumed=await query('UPDATE auth_refresh_tokens SET revoked_at=now() WHERE token_hash=$1 AND revoked_at IS NULL RETURNING id',[h]);if(!consumed.rowCount)throw new ApiError(401,'Refresh token already used');");
await save(authFile,authSource);
console.log('Frontend API patch installed. Original changed files have .before-frontend backups. Run npm install, then npm run dev in the backend.');
