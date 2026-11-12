// Test-only loopback launcher. It deliberately permits only the recorded read
// routes and login, denies other outbound connections, and uses synthetic client
// addresses so the unchanged per-IP limiter sees distinct virtual users.
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import net from 'node:net';
import path from 'node:path';
const require = createRequire(import.meta.url);
const dotenv = require('dotenv');
let source = dotenv.parse(readFileSync('server/.env'));
const config = Object.fromEntries(['DB_HOST','DB_PORT','DB_NAME','DB_USER','DB_PASSWORD','DB_SSL'].map(key=>[key,source[key]]));
source = null;
if (config.DB_NAME !== 'trackcoopdb_main' || !config.DB_HOST?.endsWith('.rds.amazonaws.com')) throw Error('Unexpected database');
for (const key of Object.keys(process.env)) {
  if (/^(PAYMONGO_|AWS_|S3_|RESEND_|SMTP_|EMAIL_|RENTAL_STATUS_EMAIL_|MEMBERSHIP_EMAIL_)/.test(key)) delete process.env[key];
}
Object.assign(process.env, { NODE_ENV:'test', DB_HOST:config.DB_HOST, DB_PORT:config.DB_PORT || '3306',
  DB_NAME:config.DB_NAME, DB_USER:config.DB_USER, DB_PASSWORD:config.DB_PASSWORD || '', DB_SSL:config.DB_SSL || 'false',
  PAYMONGO_ENABLED:'false', PAYMONGO_MODE:'test', PAYMONGO_API_BASE_URL:'http://127.0.0.1:9',
  EMAIL_DELIVERY:'disabled', STORAGE_DRIVER:'local', LOCAL_STORAGE_ROOT:path.resolve('scratch/jmeter-private/uploads'),
  FRONTEND_URL:'http://127.0.0.1:3217', CORS_ALLOWED_ORIGINS:'http://127.0.0.1:3217', TRUST_PROXY:'true' });
// loadServerEnv resolves server/.env from cwd. A private empty working directory
// prevents it from reintroducing the real integration credentials after scrubbing.
const privateCwd=path.resolve('scratch/jmeter-private');
if (existsSync(path.join(privateCwd,'server','.env'))) throw Error('Unexpected private server/.env');
process.chdir(privateCwd);
if (Object.keys(process.env).some(k=>/^PAYMONGO_.*(SECRET|KEY)/.test(k) && process.env[k])) throw Error('Payment credentials are present');

const originalConnect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function(...args) {
  let options = args[0];
  if (typeof options === 'number') options = {port:options, host:args[1] || 'localhost'};
  if (Array.isArray(options)) options = options[0];
  const host = options?.host || options?.hostname;
  const port = Number(options?.port);
  if (!((host === config.DB_HOST && port === Number(config.DB_PORT || 3306)) ||
        (['127.0.0.1','localhost','::1'].includes(host) && port === 9))) {
    throw new Error(`Blocked outbound connection: ${host || 'unknown'}:${port || 'unknown'}`);
  }
  return originalConnect.apply(this,args);
};
// The documentation-only address is rejected before DNS or network access.
let egressRejected=false;
const probe=new net.Socket();
try { probe.connect({host:'203.0.113.1',port:443}); }
catch (error) { egressRejected=String(error.message).startsWith('Blocked outbound connection:'); }
finally { probe.destroy(); }
if (!egressRejected) throw Error('Outbound network guard self-check failed');

const express = require('express');
const { createApp } = await import('../../../server/src/app.ts');
const { env } = await import('../../../server/src/config/env.ts');
if (env.PAYMONGO_ENABLED || env.PAYMONGO_MODE !== 'test' || env.EMAIL_DELIVERY !== 'disabled' ||
    env.STORAGE_DRIVER !== 'local' || env.PAYMONGO_SECRET_KEY || env.PAYMONGO_TEST_SECRET_KEY ||
    env.PAYMONGO_LIVE_SECRET_KEY || env.PAYMONGO_WEBHOOK_SECRET || env.PAYMONGO_TEST_WEBHOOK_SECRET ||
    env.PAYMONGO_LIVE_WEBHOOK_SECRET || env.PAYMONGO_API_BASE_URL !== 'http://127.0.0.1:9') {
  throw Error('Unsafe loaded integration configuration; refusing to listen');
}
const allowed = new Set(['/api/public/landing','/api/auth/me','/api/members/me/dashboard',
  '/api/membership-applications','/api/members/me/share-capital/overview','/api/members/me/share-capital/transactions',
  '/api/financial-records','/api/financial-records/summary','/api/chairman/member-analytics',
  '/api/chairman/financial-analytics','/api/rental/schedules','/api/inventory','/api/pos/orders',
  '/api/documents','/api/announcements','/api/activities','/api/health']);
const gate = express();
gate.use((req,res,next)=>{
  const slot=Number(req.get('x-jmeter-slot'));
  if (!Number.isInteger(slot) || slot<1 || slot>20) return res.status(403).json({error:'Invalid synthetic client slot'});
  if (!((req.method==='GET' && allowed.has(req.path)) || (req.method==='POST' && req.path==='/api/auth/login'))) return res.status(403).json({error:'Endpoint unavailable in performance environment'});
  req.headers['x-forwarded-for'] = `198.18.0.${slot}`;
  next();
});
gate.use(createApp({enableRequestLogging:false}));
gate.listen(3218,'127.0.0.1',()=>console.log('Performance API listening on 127.0.0.1:3218; external egress blocked; synthetic per-user IPs enabled'));
