import { createServer,type Server } from "node:http";
import { expect,test,type Page } from "@playwright/test";
import fixture from "../fixtures/finance-monitoring.json";
import { createRfmWorkbook } from "../../server/src/modules/member-indicators/member-indicator.export";
import { financeFilterSchema,dateScope } from "../../server/src/modules/finance-monitoring/finance-monitoring.schema";
const port=Number(process.env.PLAYWRIGHT_API_PORT??5357),origin=process.env.PLAYWRIGHT_BASE_URL??'http://localhost:3138';
const chairman={id:'1',displayName:'Chairman Fixture',username:'chair',email:'chair@example.test',role:'chairman',accountStatus:'Active'};
const envelope=(data:unknown,meta:Record<string,unknown>={})=>({success:true,data,message:'Fixture',meta});
let server:Server;
test.beforeAll(async()=>{server=createServer((req,res)=>{res.setHeader('content-type','application/json');const role=req.headers.cookie?.includes('fixture-bookkeeper')?'bookkeeper':'chairman';res.end(JSON.stringify(envelope(req.url==='/api/auth/me'?{...chairman,role}:[])));});await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(port,resolve);});});
test.afterAll(async()=>{server?.closeAllConnections();await new Promise<void>((resolve,reject)=>server?.close(e=>e?reject(e):resolve()));});
const now=new Date('2026-11-03T02:00:00Z');
function detail(){const row=fixture.payment.items.find(r=>r.id==='12')!;return{...row,provider:'Cash',submittedByName:'Bookkeeper',validatedByName:'Bookkeeper',validationHistory:[{id:'h1',oldStatus:'Pending',newStatus:'Validated',validationSource:'Manual Bookkeeper',reason:'Verified',changedBy:'2',changedByName:'Bookkeeper',gatewayEventId:null,changedAt:'2026-10-02T00:00:00Z'}],checkoutAttempts:[],activeAttemptId:null,gatewayEvents:[],receipt:{receiptNumber:'RCPT-12',processingStatus:'Generated',documentId:null,attemptCount:1,lastErrorCode:null,lastErrorMessage:null,generatedAt:'2026-10-02T00:00:00Z',reversedAt:null,reversalNote:null},posting:{financialRecordId:null,financialRecordNumber:null,financialRecordStatus:null,shareCapitalPaymentId:'2',shareCapitalStatus:'Validated',membershipRequirementId:null,membershipRequirementStatus:null,membershipApplicationStatus:null,warnings:[]}};}
async function setup(page:Page,{role='chairman',fail=false}:{role?:string;fail?:boolean}={}){
 await page.context().addCookies([{name:'trackcoop_session',value:`fixture-${role}`,url:origin},{name:'fixture_role',value:role,url:origin}]);const requests:URL[]=[];let failing=fail;
 await page.route('**/api/**',async route=>{
  const url=new URL(route.request().url()),path=url.pathname;requests.push(url);
  const respond=(data:unknown,meta:Record<string,unknown>={})=>route.fulfill({json:envelope(data,meta)});
  if(path==='/api/auth/me')return respond({...chairman,role});
  if(path==='/api/finance-monitoring/options')return respond({barangays:['Aga','Wawa'],sectors:['Rice','Corn'],transactionTypes:['Initial Share Capital','Additional Capital Contribution','Dividend Added to Share Capital','Reversal']});
  if(path.endsWith('/export'))return route.fulfill({headers:{'content-type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','content-disposition':'attachment; filename="fixture.xlsx"'},body:await createRfmWorkbook([{name:'Fixture',rows:[['Source','Amount'],['Isolated SQL fixture',fixture.payment.summary.validatedVolume]]}])});
  if(path==='/api/finance-monitoring/payment/12')return respond({paymentId:'12',memberId:'1',capitalTransactionId:'2',warnings:[]});
  if(path==='/api/payment-references/12')return respond(detail());
  if(path==='/api/finance-monitoring/payments'){
   if(failing)return route.fulfill({status:503,json:{success:false,message:'Fixture monitoring temporarily unavailable',errors:[]}});
   const data=structuredClone(fixture.payment),filters=financeFilterSchema.parse(Object.fromEntries(url.searchParams));const scope=dateScope(filters,now);
   let rows=data.items;
   if(filters.status)rows=rows.filter(r=>r.validationStatus===filters.status);
   if(filters.view==='manual')rows=rows.filter(r=>r.validationStatus==='Pending'&&r.paymentChannel!=='PayMongo');
   if(filters.view==='validations')rows=rows.filter(r=>['Validated','Reversed'].includes(r.validationStatus));
   if(filters.search)rows=rows.filter(r=>`${r.payerName} ${r.referenceNumber}`.toLowerCase().includes(filters.search.toLowerCase()));
   data.total=filters.status||filters.view||filters.search?rows.length:25;data.page=filters.page;data.pageSize=filters.pageSize;data.items=rows.slice(0,filters.pageSize);return respond({...data,scope});
  }
  if(path==='/api/finance-monitoring/capital'){
   if(failing)return route.fulfill({status:503,json:{success:false,message:'Fixture monitoring temporarily unavailable',errors:[]}});
   const data=structuredClone(fixture.capital),filters=financeFilterSchema.parse(Object.fromEntries(url.searchParams));const scope=dateScope(filters,now);
   let rows=data.payments.items;if(filters.status)rows=rows.filter(r=>r.paymentStatus===filters.status);
   data.payments={...data.payments,items:rows,page:filters.page,total:rows.length,pageSize:filters.pageSize};return respond({...data,scope});
  }
  if(path==='/api/finance-monitoring/capital/accounts'){
   const data=structuredClone(fixture.capital);if(url.searchParams.get('memberId'))data.accounts=data.accounts.filter(r=>r.memberId===url.searchParams.get('memberId'));if(url.searchParams.get('reconciliation')==='review')data.accounts=data.accounts.filter(r=>!r.reconciled||r.sourceIssues||r.missingCredits);data.total=data.accounts.length;return respond(data);
  }
  if(path==='/api/finance-monitoring/capital/transactions')return respond(fixture.transactions);
  if(path==='/api/share-capital')return respond(fixture.capital.payments.items,{total:611,page:Number(url.searchParams.get('page')??1),pageSize:Number(url.searchParams.get('pageSize')??5)});
  if(path==='/api/share-capital/summary')return respond({currentBalance:7750,capitalHolders:4,validatedTotal:6000,pendingTotal:700,validatedPayments:5,membersWithValidatedCapital:4,initialRequirement:1500,fullRequirement:3000,maximumAllowed:15000});
  if(path==='/api/payment-references/summary')return respond({total:12,pendingTotal:2,pendingManual:1,needsClarification:1,validatedToday:4,validatedTotal:7,paymongoTestPayments:1,rejected:1,reversed:1,validatedAmount:1570.3});
  if(path==='/api/payment-references')return respond({items:fixture.payment.items,total:12,page:1,pageSize:5});
  return respond([],{total:0,page:1,pageSize:10});
 });
 return{requests,recover:()=>{failing=false;}};
}
const paymentPath='/portal/chairman/payments?period=all';const capitalPath='/portal/chairman/share-capital?period=all';
for(const width of [1440,768,390])test(`payments and capital retain usable compact layouts at ${width}px`,async({page},info)=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await setup(page);await page.setViewportSize({width,height:1000});
 for(const [path,name] of [[paymentPath,'Payment monitoring KPIs'],[capitalPath,'Share Capital monitoring KPIs']]){
  await page.goto(path);await expect(page.getByRole('region',{name,exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Apply filters',exact:true})).toBeEnabled();
  await page.screenshot({path:info.outputPath(`${name.startsWith('Payment')?'payments':'capital'}-${width}.png`),fullPage:true});
  const layout=await page.evaluate(()=>({width:window.innerWidth,scroll:document.documentElement.scrollWidth}));
  expect(layout.scroll,JSON.stringify(layout)).toBeLessThanOrEqual(width+1);
 }
 expect(errors).toEqual([]);
});
test('payment KPI selection scopes the table while preserving non-status filters; pagination and URL persistence work',async({page})=>{
 const {requests}=await setup(page);await page.goto(paymentPath);const region=page.getByRole('region',{name:'Payment monitoring KPIs'});
 await region.getByRole('button',{name:/^Pending Manual Review:/}).click();await expect(page).toHaveURL(/view=manual/);await expect(page.getByText('Page 1 of 1 · 1 payment references')).toBeVisible();
 await expect(region.getByRole('button',{name:/^Needs Clarification:/})).toContainText('1');
 await region.getByRole('button',{name:/^Validated Payments:/}).click();await expect(page).toHaveURL(/view=validations/);await expect.poll(()=>requests.filter(u=>u.pathname==='/api/finance-monitoring/payments').at(-1)?.searchParams.get('dateType')).toBe('submitted');
 await page.getByRole('button',{name:'Clear all',exact:true}).click();await expect(page).not.toHaveURL(/view=manual/);
 await page.getByRole('button',{name:'Next',exact:true}).click();await expect.poll(()=>requests.filter(u=>u.pathname==='/api/finance-monitoring/payments').at(-1)?.searchParams.get('page')).toBe('2');
 await page.reload();await expect(page).toHaveURL(/page=2/);await expect(page.getByText('Page 2 of 3 · 25 payment references')).toBeVisible();
});
test('filter staging, debounced search, custom comboboxes and removable chips preserve API values',async({page})=>{
 const {requests}=await setup(page);await page.goto(paymentPath);await page.getByLabel('Payment channel',{exact:true}).click();await page.getByRole('option',{name:'QRPH',exact:true}).click();
 await page.getByRole('button',{name:'Apply filters',exact:true}).click();await expect(page).toHaveURL(/channel=PayMongo/);
 await page.getByRole('button',{name:'More finance filters'}).click();await page.getByLabel('Payment environment',{exact:true}).click();await page.getByRole('option',{name:'Test',exact:true}).click();await page.getByRole('button',{name:'Apply filters',exact:true}).click();await expect(page).toHaveURL(/environment=Test/);
 await page.getByRole('button',{name:'Remove Environment filter'}).click();await expect(page).not.toHaveURL(/environment=Test/);
 const before=requests.filter(u=>u.pathname==='/api/finance-monitoring/payments').length;await page.getByLabel('Search payer, member or reference',{exact:true}).fill('PAY-12');
 expect(requests.filter(u=>u.pathname==='/api/finance-monitoring/payments').length-before).toBeLessThanOrEqual(1);
 await expect(page).toHaveURL(/search=PAY-12/);await expect(page.getByText('Page 1 of 1 · 1 payment references')).toBeVisible();
 await page.getByRole('button',{name:'Clear all',exact:true}).click();await expect(page).not.toHaveURL(/search=PAY-12/);
});
test('KPI definitions open a keyboard-accessible right drawer and return focus; exports download',async({page})=>{
 await setup(page);await page.goto(paymentPath);const about=page.getByRole('button',{name:'About Validated Payment Volume'});await about.click();const drawer=page.getByRole('dialog',{name:'Validated Payment Volume'});await expect(drawer).toContainText('payment_validation_history');await expect(drawer).toContainText('Volume by purpose');await page.keyboard.press('Escape');await expect(drawer).toBeHidden();await expect(about).toBeFocused();
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export Excel',exact:true}).click();expect((await download).suggestedFilename()).toBe('trackcoop-payments-monitoring.xlsx');
});
test('payment deep-link preserves the existing read-only dialog and opens the related capital account',async({page})=>{
 await setup(page);await page.goto(`${paymentPath}&paymentId=12`);const dialog=page.getByRole('dialog',{name:'PAY-12',exact:true});await expect(dialog).toBeVisible();await expect(dialog.getByRole('button',{name:'Approve payment',exact:true})).toHaveCount(0);await expect(dialog.getByRole('button',{name:'Reverse payment',exact:true})).toHaveCount(0);
 await dialog.getByRole('link',{name:/View linked capital account/}).click();await expect(page).toHaveURL(/memberId=1/);await expect(page.getByRole('main').getByRole('heading',{name:'Share Capital',exact:true})).toBeVisible();
});
test('capital holders, requirements, contribution activity and reconciliation have meaningful drill-downs',async({page})=>{
 const {requests}=await setup(page);await page.goto(capitalPath);const region=page.getByRole('region',{name:'Share Capital monitoring KPIs'});await expect(region.getByRole('button',{name:/^Total Current Share Capital:/})).toContainText('7,750.00');await expect(region.getByRole('button',{name:/^Full Requirement Completion:/})).toContainText('N/A');
 await region.getByRole('button',{name:/^Members Holding Capital:/}).click();await expect(page.getByRole('dialog',{name:'Members holding capital'})).toBeVisible();await expect.poll(()=>requests.filter(u=>u.pathname.endsWith('/capital/accounts')).at(-1)?.searchParams.get('balanceMin')).toBe('0.01');await page.keyboard.press('Escape');
 await region.getByRole('button',{name:/^Member Contributions This Period:/}).click();await expect(page.getByRole('dialog',{name:'Posted member contributions'})).toBeVisible();await expect.poll(()=>requests.filter(u=>u.pathname.endsWith('/capital/transactions')).at(-1)?.searchParams.get('transactionGroup')).toBe('contributions');await page.keyboard.press('Escape');
 await page.getByRole('button',{name:/Reconciliation review/}).click();await expect(page.getByRole('dialog',{name:'Accounts requiring review'})).toContainText('Dora');await page.keyboard.press('Escape');
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export Excel',exact:true}).click();expect((await download).suggestedFilename()).toBe('trackcoop-capital-monitoring.xlsx');
});
test('capital stages, deadlines and history date filters use the shared controls',async({page})=>{
 await setup(page);await page.goto(capitalPath);await page.getByLabel('Capital completion stage',{exact:true}).click();await page.getByRole('option',{name:'Below ₱1,500',exact:true}).click();await page.getByRole('button',{name:'More finance filters'}).click();await page.getByLabel('Recorded deadline',{exact:true}).click();await page.getByRole('option',{name:'Overdue',exact:true}).click();await page.getByRole('button',{name:'Apply filters',exact:true}).click();await expect(page).toHaveURL(/stage=belowInitial/);await expect(page).toHaveURL(/deadline=overdue/);
 await page.getByRole('button',{name:'Remove Deadline filter'}).click();await expect(page).not.toHaveURL(/deadline=overdue/);
 await page.goBack();await expect(page).toHaveURL(/deadline=overdue/);
});

test('custom dates use the existing calendar and historical capital stays explicitly identified',async({page})=>{
 await setup(page);await page.goto(paymentPath);await page.getByLabel('Reporting period',{exact:true}).click();await page.getByRole('option',{name:'Custom date range',exact:true}).click();
 for(const [label,date] of [['Reporting start','1'],['Reporting end','2']]){
  await page.getByLabel(label,{exact:true}).click();const picker=page.getByRole('dialog',{name:label,exact:true});
  await picker.getByRole('button',{name:'Month',exact:true}).click();await picker.getByRole('option',{name:'November',exact:true}).click();
  await picker.getByRole('button',{name:'Year',exact:true}).click();await picker.getByRole('option',{name:'2026',exact:true}).click();
  await picker.getByRole('button',{name:date,exact:true}).first().click();await picker.getByRole('button',{name:'Confirm',exact:true}).click();
 }
 await page.getByRole('button',{name:'Apply filters',exact:true}).click();await expect(page).toHaveURL(/start=2026-11-01/);await expect(page).toHaveURL(/end=2026-11-02/);
 await page.goto(`${capitalPath}&asOf=2026-10-01`);await expect(page.getByText(/Historical balances use recorded posted movements through 2026-10-01/)).toBeVisible();
 await expect(page.getByRole('button',{name:/^Recorded capital as of:/})).toBeVisible();
});
test('empty results and API errors are recoverable without fabricating balances',async({page})=>{
 const state=await setup(page,{fail:true});await page.goto(paymentPath);await expect(page.getByRole('alert').filter({hasText:'Fixture monitoring temporarily unavailable'})).toBeVisible();state.recover();await page.getByRole('button',{name:'Retry monitoring'}).click();await expect(page.getByRole('button',{name:/^Validated Payments:/})).not.toContainText('…');
 await page.getByLabel('Search payer, member or reference',{exact:true}).fill('missing member');await expect(page.getByText('No payment references found')).toBeVisible();
});
test('Bookkeeper capital recording remains available while Chairman pages remain read-only',async({page})=>{
 await setup(page,{role:'bookkeeper'});await page.goto('/portal/bookkeeper/share-capital');await expect(page.getByRole('button',{name:'Record Payment',exact:true})).toBeVisible();
 await page.goto('/portal/bookkeeper/payment-validation');await expect(page.getByRole('main').getByRole('heading',{name:'Payments to Check',exact:true})).toBeVisible();
});
