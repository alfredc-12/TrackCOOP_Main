"use client";
import { useEffect,useId,useState } from "react";
import { ChevronDown,Filter,X } from "lucide-react";
import { StyledSelect } from "@/components/ui/StyledSelect";
import { DatePicker } from "@/components/ui/DatePicker";
import { Button } from "@/components/ui/Button";
import { apiRequest } from "@/lib/api-client";
import type { MonitorQuery } from "./monitor-client";
import styles from "./FinanceMonitoring.module.css";
export const periodChoices=[['month','This month'],['today','Today'],['yesterday','Yesterday'],['last7','Last 7 days'],['last30','Last 30 days'],['lastMonth','Last month'],['year','This year'],['custom','Custom date range'],['all','All time']];
export const stageChoices=[['','All capital stages'],['none','No recorded capital'],['belowInitial','Below ₱1,500'],['initialToFull','₱1,500–₱2,999.99'],['fullToMax','₱3,000–₱14,999.99'],['atMax','At ₱15,000'],['aboveMax','Above ₱15,000 · review classification']];
export function MonitorSelect({label,value,options,onChange}:{label:string;value:string;options:Array<string|string[]>;onChange:(v:string)=>void}){const id=useId(),items=options.map(o=>typeof o==='string'?[o,o]:o);return <div className={styles.field}><label htmlFor={id}>{label}</label><StyledSelect id={id} aria-label={label} value={items.find(([v])=>v===value)?.[1]??value} options={items.map(([,l])=>l)} onChange={label=>{const item=items.find(([,l])=>l===label);if(item)onChange(item[0]);}}/></div>;}
const purposes=['Associate Membership Fee','Share Capital','Rental','POS/Product','Preorder','Bulk Order','Document/Certificate','Other'];
const names:Record<string,string>={search:'Search',status:'Status',view:'View',purpose:'Purpose',channel:'Channel',environment:'Environment',validationSource:'Validation source',minAmount:'Minimum amount',maxAmount:'Maximum amount',reference:'Reference',failedEvents:'Failed events',receipt:'Receipt',financialPosting:'Financial posting',capitalPosting:'Capital posting',membershipType:'Membership type',barangay:'Barangay',sector:'Sector',stage:'Capital stage',deadline:'Deadline',reconciliation:'Reconciliation',balanceMin:'Minimum balance',balanceMax:'Maximum balance',asOf:'Balance date',transactionType:'Transaction type',direction:'Direction',transactionStatus:'Transaction status',memberId:'Member'};
export function MonitorFilters({kind,query,onApply,onReset,loading}:{kind:'payments'|'capital';query:MonitorQuery;onApply:(q:MonitorQuery)=>void;onReset:()=>void;loading:boolean}){
 const [draft,setDraft]=useState(query),[advanced,setAdvanced]=useState(false),[problem,setProblem]=useState('');
 const [options,setOptions]=useState<{barangays:string[];sectors:string[];transactionTypes:string[]}>({barangays:[],sectors:[],transactionTypes:[]});
 const id=useId();
 useEffect(()=>{
  if((draft.search??'')===(query.search??''))return;
  if(draft.period==='custom'&&(!draft.start||!draft.end||draft.start>draft.end))return;
  const timer=window.setTimeout(()=>onApply({...draft,page:'1'}),350);
  return()=>window.clearTimeout(timer);
 },[draft,query.search,onApply]);
 useEffect(()=>{if(kind!=='capital')return;const controller=new AbortController();apiRequest<typeof options>('/api/finance-monitoring/options',{signal:controller.signal}).then(o=>{if(!controller.signal.aborted)setOptions(o);}).catch(()=>{});return()=>controller.abort();},[kind]);
 const set=(key:string,value:string)=>setDraft(d=>({...d,[key]:value}));
 const choice=(key:string,label:string,items:Array<string|string[]>)=><MonitorSelect label={label} value={draft[key]??''} options={items} onChange={v=>set(key,v)} />;
 const text=(key:string,label:string,numeric=false)=><label className={styles.field}><span>{label}</span><input type={numeric?'text':'search'} inputMode={numeric?'decimal':undefined} value={draft[key]??''} maxLength={numeric?15:190} onChange={e=>set(key,e.target.value)} /></label>;
 const chips=Object.entries(query).filter(([k,v])=>v&&names[k]&&!(k==='environment'&&v==='Operational')&&!(k==='asOf'&&v===''));
 const submit=()=>{if(draft.period==='custom'&&(!draft.start||!draft.end||draft.start>draft.end)){setProblem('Choose a valid reporting start and end.');return;}setProblem('');onApply({...draft,page:'1'});};
 return <form className={styles.panel} aria-label={`${kind==='payments'?'Payment':'Share Capital'} monitoring filters`} onSubmit={e=>{e.preventDefault();submit();}}>
 <div className={`${styles.toolbar} mb-3`}><div className={styles.actions}><h2 className="font-semibold"><Filter className="mr-2 inline size-4" aria-hidden="true"/>Filters</h2><button type="button" className={styles.close} aria-label="More finance filters" aria-expanded={advanced} aria-controls={id} onClick={()=>setAdvanced(v=>!v)}><ChevronDown className={`size-4 ${advanced?'rotate-180':''}`} aria-hidden="true" /></button></div><div className={styles.actions}><Button type="button" variant="secondary" onClick={onReset}>Clear all</Button><Button type="submit" disabled={loading}>Apply filters</Button></div></div>
 <div className={styles.fields}>{text('search',kind==='payments'?'Search payer, member or reference':'Search member or code')}{choice('period','Reporting period',periodChoices)}{choice('status','Payment status',[['','All statuses'],'Pending','Validated','Rejected',...(kind==='payments'?['Needs Clarification']:[]),'Reversed'])}
 {kind==='payments'?<>{choice('purpose','Payment purpose',[['','All purposes'],...purposes])}{choice('channel','Payment channel',[['','All channels'],['PayMongo','QRPH'],'Cash','Manual GCash','Bank Transfer','Other'])}</>:<>{choice('membershipType','Membership type',[['','All types'],'Associate','True Member'])}{choice('stage','Capital completion stage',stageChoices)}</>}
 {draft.period==='custom'&&<><DatePicker label="Reporting start" value={draft.start??''} max={draft.end||undefined} onChange={v=>set('start',v)}/><DatePicker label="Reporting end" value={draft.end??''} min={draft.start||undefined} onChange={v=>set('end',v)}/></>}
 </div>
 <div id={id} hidden={!advanced} className="mt-4"><div className={styles.fields}>
 {choice('environment',kind==='payments'?'Payment environment':'Collection environment',['Operational','All','Live','Test','Manual'])}
 {kind==='payments'?<>
 {choice('dateType','Reference date',[['submitted','Submitted date'],['paid','Paid date'],['validated','Validated date']])}
 {choice('view','Operational group',[['','All references'],['manual','Pending manual review'],['gateway','Pending gateway'],['validations','Validation events'],['reversals','Reversal events'],['exceptions','Processing and posting review']])}
 {choice('validationSource','Validation source',[['','All sources'],'Manual Bookkeeper','PayMongo Webhook','System'])}
 {choice('failedEvents','Gateway events',[['','All events'],['yes','Has failed event']])}
 {choice('receipt','Receipt processing',[['','All receipts'],'Pending','Processing','Generated','Failed',['Missing','No receipt record']])}
 {choice('financialPosting','Financial posting',[['','All applicable records'],'Posted','Missing','Duplicate'])}
 {choice('capitalPosting','Share-capital posting',[['','All applicable records'],'Posted','Missing','Duplicate'])}
 </>:<>
 {choice('barangay','Barangay',[['','All barangays'],...options.barangays])}{choice('sector','Sector',[['','All sectors'],...options.sectors])}
 {choice('deadline','Recorded deadline',[['','All deadline categories'],['met','Requirement met'],['dueSoon','Due soon'],['overdue','Overdue'],['missing','Deadline not recorded'],['na','Not applicable']])}
 {choice('dueSoonDays','Due-soon threshold',[['7','Within 7 days'],['30','Within 30 days']])}
 {choice('reconciliation','Reconciliation',[['','All accounts'],['reconciled','Reconciled'],['review','Needs review'],['noAccount','No ledger account']])}
 {choice('channel','Contribution channel',[['','All channels'],['PayMongo','QRPH'],'Cash','Manual GCash','Bank Transfer','Other'])}
 {choice('transactionType','Ledger transaction type',[['','All types'],...options.transactionTypes])}{choice('direction','Ledger direction',[['','All directions'],'Credit','Debit'])}{choice('transactionStatus','Ledger status',[['','All ledger statuses'],'Posted','Reversed'])}
 <DatePicker label="Balance as of" value={draft.asOf??''} placeholder="Current account balance" allowClear onChange={v=>set('asOf',v)}/>{text('balanceMin','Minimum capital balance',true)}{text('balanceMax','Maximum capital balance',true)}
 </>}
 {text('minAmount','Minimum activity amount',true)}{text('maxAmount','Maximum activity amount',true)}{text('reference','Payment or ledger reference')}
 {choice('sortBy','Sort by',[['date','Date'],['name','Name'],['amount','Amount'],['reference','Reference']])}{choice('sortDirection','Sort direction',[['desc','Descending'],['asc','Ascending']])}{choice('pageSize','Rows per page',['5','10','20','50','100'])}
 </div></div>
 {problem&&<p role="alert" className={`${styles.error} mt-3`}>{problem}</p>}
 {chips.length>0&&<div className={styles.chips} aria-label="Active finance filters">{chips.map(([key,value])=><button key={key} type="button" className={styles.chip} aria-label={`Remove ${names[key]} filter`} onClick={()=>onApply({...query,[key]:'',page:'1'})}>{names[key]}: {value==='PayMongo'?'QRPH':value}<X className="size-3" aria-hidden="true"/></button>)}</div>}
 </form>;
}
