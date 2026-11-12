import { chromium } from 'playwright';
import mysql from 'mysql2/promise';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const db = await mysql.createConnection({host:'127.0.0.1',port:33327,user:'root',database:'trackcoop_evidence_synthetic'});
const [identity] = await db.query('SELECT @@port port,@@datadir dir,DATABASE() db'); await db.end();
const dir=String(identity[0].dir).replaceAll('\\','/').replace(/\/$/,'').toLowerCase();
if(Number(identity[0].port)!==33327 || identity[0].db!=='trackcoop_evidence_synthetic' || !dir.endsWith('/trackcoop_main/scratch/playwright-isolated-mysql/data')) throw Error('Refusing unverified database');
const root='evidence/playwright/final-screenshots';
const plans=[
 ['public','public-authentication','home','/',''],
 ['public','public-authentication','cooperative-information','/about/our-cooperative',''],
 ['public','public-authentication','login','/login',''],
 ['public','public-authentication','membership-application','/membership/apply',''],
 ['public','rental-management','rental-services','/rental',''],
 ['chairman','chairman-membership','member-analytics','/portal/chairman/dashboard',''],
 ['chairman','chairman-membership','member-directory','/portal/chairman/members',''],
 ['chairman','chairman-membership','membership-applications','/portal/chairman/members/applications',''],
 ['chairman','share-capital','share-capital-overview','/portal/chairman/share-capital',''],
 ['chairman','financial-management','financial-analytics','/portal/chairman/financial-dashboard',''],
 ['chairman','member-analytics','engagement-workspace','/portal/chairman/member-indicators',''],
 ['chairman','rental-management','rental-bookings','/portal/chairman/rentals/bookings',''],
 ['chairman','events-attendance','event-management','/portal/chairman/activities',''],
 ['chairman','announcements-notifications','announcements','/portal/chairman/announcements',''],
 ['bookkeeper','member-bookkeeper-portals','bookkeeper-dashboard','/portal/bookkeeper/financial-dashboard',''],
 ['bookkeeper','financial-management','financial-ledger','/portal/bookkeeper/financial-ledger',''],
 ['bookkeeper','financial-management','financial-categories','/portal/bookkeeper/financial-categories',''],
 ['bookkeeper','financial-management','payment-validation','/portal/bookkeeper/payment-validation',''],
 ['bookkeeper','pos-sales','product-inventory','/portal/bookkeeper/products-inventory',''],
 ['bookkeeper','pos-sales','pos-sales','/portal/bookkeeper/pos-sales',''],
 ['bookkeeper','document-management','document-repository','/portal/bookkeeper/documents',''],
 ['bookkeeper','rental-management','rental-transactions','/portal/bookkeeper/rental-transactions',''],
 ['member','member-bookkeeper-portals','member-dashboard','/portal/member/dashboard',''],
 ['member','share-capital','member-share-capital','/portal/member/share-capital','My Share Capital'],
 ['member','member-bookkeeper-portals','member-requests','/portal/member/requests',''],
];
const accounts={chairman:['chairman.test@trackcoop.local','ChairmanTest123!'],bookkeeper:['bookkeeper.test@trackcoop.local','BookkeeperTest123!'],member:['maria.member@trackcoop.local','MemberTest123!']};
const browser=await chromium.launch({headless:true});const result=[];
try {
 for(const role of ['public','chairman','bookkeeper','member']) {
  const ctx=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1});
  await ctx.route('**/*', route=>{const u=new URL(route.request().url());return ['127.0.0.1','localhost'].includes(u.hostname)||['data:','blob:'].includes(u.protocol)?route.continue():route.abort();});
  if(role!=='public') {const [identifier,password]=accounts[role];const resp=await ctx.request.post('http://127.0.0.1:3218/api/auth/login',{data:{identifier,password}});if(resp.status()!==200) throw Error(`Login failed for ${role}: ${resp.status()}`);}
  const page=await ctx.newPage();
  for(const [,folder,name,url,heading] of plans.filter(x=>x[0]===role)) {
   const file=path.join(root,folder,`${name}.png`); await mkdir(path.dirname(file),{recursive:true});
   try {const response=await page.goto(`http://127.0.0.1:3217${url}`,{waitUntil:'domcontentloaded',timeout:30000});await page.locator('main').first().waitFor({state:'visible',timeout:15000});
    await page.getByText('Loading TrackCOOP...', {exact:true}).waitFor({state:'hidden',timeout:15000}).catch(()=>{});
    if(heading) await page.getByRole('heading',{name:heading,exact:true}).first().waitFor({state:'visible',timeout:15000});
    await page.waitForLoadState('networkidle',{timeout:8000}).catch(()=>{});
    const title=await page.locator('main h1, main h2').first().innerText({timeout:3000}).catch(()=>'');
    const body=await page.locator('body').innerText();
    const invalid=(response?.status()??0)>=400 || /Page not found|Internal Server Error|Application error/i.test(body) || /\/login/.test(page.url())&&role!=='public';
    if(invalid) throw Error(`Unexpected page ${response?.status()} ${page.url()}`);
    await page.screenshot({path:file,fullPage:true,animations:'disabled'}); result.push({role,folder,name,route:url,heading:title,file,status:'captured',http:response?.status()});
    console.log(`CAPTURED ${role} ${name} ${title}`);
   } catch(e) {result.push({role,folder,name,route:url,status:'unavailable',reason:String(e.message).slice(0,250)});console.log(`UNAVAILABLE ${role} ${name} ${String(e.message).slice(0,160)}`);}
  }
  await ctx.close();
 }
} finally {await browser.close();await mkdir(root,{recursive:true});await writeFile(path.join(root,'capture-log.json'),JSON.stringify(result,null,2));}
