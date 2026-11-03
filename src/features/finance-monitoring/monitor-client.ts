"use client";
import { useEffect,useMemo,useState,useSyncExternalStore } from "react";
import { apiRequest,ApiClientError } from "@/lib/api-client";
import { env } from "@/config/env";
import type { FinanceMonitoringService } from "../../../server/src/modules/finance-monitoring/finance-monitoring.service";
import type { PaymentMonitor as ServerPaymentMonitor } from "../../../server/src/modules/finance-monitoring/payment-monitoring";
type Json<T> = T extends Date ? string : T extends (infer U)[] ? Json<U>[] : T extends object ? { [K in keyof T]: Json<T[K]> } : T;
export type PaymentMonitor = Json<ServerPaymentMonitor>;
export type { CapitalMonitor,CapitalAccount } from "../../../server/src/modules/finance-monitoring/capital-monitoring";
export type { CapitalPaymentRow,CapitalTransactionRow } from "../../../server/src/modules/finance-monitoring/capital-lists";
export type CapitalReport=Awaited<ReturnType<FinanceMonitoringService['capital']>>;
export type MonitorQuery=Record<string,string>;
const defaults:MonitorQuery={period:'month',environment:'Operational',dateType:'submitted',page:'1',pageSize:'10',sortBy:'date',sortDirection:'desc',dueSoonDays:'7'};
const subscribe=(callback:()=>void)=>{window.addEventListener('popstate',callback);window.addEventListener('finance-query',callback);return()=>{window.removeEventListener('popstate',callback);window.removeEventListener('finance-query',callback);};};
const snapshot=()=>window.location.search;
export function useFinanceMonitor<T>(kind:'payments'|'capital',enabled=true){
 const location=useSyncExternalStore(subscribe,snapshot,()=>'');
 const query=useMemo(()=>({...defaults,...Object.fromEntries(new URLSearchParams(location))}),[location]);
 const params=useMemo(()=>new URLSearchParams(Object.entries(query).filter(([,v])=>v!=='')),[query]);
 const [revision,setRevision]=useState(0);
 const key=`${params.toString()}:${revision}`;
 const [result,setResult]=useState<{data:T|null;key:string;error:string}>({data:null,key:'',error:''});
 useEffect(()=>{
  if(!enabled)return;
  const controller=new AbortController();
  apiRequest<T>(`/api/finance-monitoring/${kind}?${params}`,{signal:controller.signal}).then(data=>{if(!controller.signal.aborted)setResult({data,key,error:''});}).catch(error=>{if(!controller.signal.aborted)setResult(current=>({...current,key,error:error instanceof Error?error.message:'Finance monitoring could not be loaded.'}));});
  return()=>controller.abort();
 },[enabled,kind,key,params]);
 const apply=(next:MonitorQuery)=>{const p=new URLSearchParams(Object.entries(next).filter(([,v])=>v!==''));window.history.pushState(null,'',`${window.location.pathname}?${p}`);window.dispatchEvent(new Event('finance-query'));};
 return {data:result.data,loading:enabled&&result.key!==key,error:result.key===key?result.error:'',query,key:params.toString(),location,
 apply,patch:(patch:MonitorQuery)=>apply({...query,...patch,page:patch.page??'1'}),reset:()=>apply({...defaults}),refresh:()=>setRevision(r=>r+1)};
}
export async function downloadFinance(kind:'payments'|'capital',query:MonitorQuery){
 const response=await fetch(`${env.apiUrl}/api/finance-monitoring/${kind}/export?${new URLSearchParams(query)}`,{credentials:'include'});
 if(!response.ok){const body=await response.json().catch(()=>null);throw new ApiClientError(body?.message??'The export could not be generated.',response.status);}
 const url=URL.createObjectURL(await response.blob());const a=document.createElement('a');a.href=url;a.download=`trackcoop-${kind}-monitoring.xlsx`;a.click();URL.revokeObjectURL(url);
}
export function peso(value:string|number|null|undefined){
 if(value==null)return '—';
 const text=typeof value==='number'?value.toFixed(2):value;
 const match=/^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(text);
 if(!match)return '—';
 const whole=new Intl.NumberFormat('en-PH',{maximumFractionDigits:0}).format(BigInt(match[2]));
 return `${match[1]}₱${whole}.${(match[3]??'').padEnd(2,'0')}`;
}
export const count=(value:number|undefined)=>value===undefined?'—':value.toLocaleString('en-PH');
export const stamp=(value:Date|string|null|undefined)=>value?new Date(value).toLocaleString('en-PH',{timeZone:'Asia/Manila',year:'numeric',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'Not recorded';
export const day=(value:string)=>new Date(`${value.slice(0,10)}T12:00:00Z`).toLocaleDateString('en-PH',{year:'numeric',month:'short',day:'numeric'});
export const scopeText=(scope:{start:string|null;end:string|null})=>scope.start&&scope.end?`${day(scope.start)} – ${day(scope.end)}`:'All time';
