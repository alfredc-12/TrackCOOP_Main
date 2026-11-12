"""Compile nine verified runs into reproducible summaries and measured figures."""
import csv
import datetime as dt
import importlib.util
import json
import math
import re
import statistics
import sys
from collections import defaultdict
from pathlib import Path

ROOT=Path(__file__).resolve().parents[3]; E=ROOT/'evidence/jmeter'
sys.path.insert(0,str(ROOT/'scratch/jmeter-private/python-packages'))
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
spec=importlib.util.spec_from_file_location('summarize',E/'scripts/summarize.py')
mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)

def read(path):return json.loads(path.read_text(encoding='utf8'))
def re_match_tx(label):return re.fullmatch(r'TX_J(?:0[1-9]|10)',label) is not None
def raw_samples(path,start):
    result=[]
    with path.open(newline='',encoding='utf-8-sig') as f:
        for row in csv.DictReader(f):
            match=mod.GROUP.match(row['label']);ts=int(row['timeStamp']);elapsed=int(row['elapsed'])
            if match and ts>=start and ts+elapsed<=start+300000:
                result.append({'group':match.group(1),'elapsed':elapsed,'success':row['success'].lower()=='true',
                    'bytes':int(row['bytes']),'threads':int(row['allThreads']),'timestamp':ts})
    return result

runs=[]; pooled=defaultdict(list); groups=defaultdict(list); transactions=[]
for i in range(1,10):
    run=f'JMR{i:02}';d=E/'runs'/run
    info=read(d/'run.json');summary=read(d/'steady-summary.json');before=read(E/'integrity'/f'{run}-before.json');after=read(E/'integrity'/f'{run}-after.json')
    if info['jmeter_exit_code'] or info['missing_groups'] or not info['target_threads_maintained'] or not info['html_report_exists']:
        raise SystemExit(f'{run} incomplete or invalid; preserve evidence and inspect')
    samples=raw_samples(d/'results.jtl',info['steady_start_epoch_ms'])
    if len(samples)!=summary['overall']['samples']:raise SystemExit(f'{run} sample count mismatch')
    txgroups=defaultdict(list)
    with (d/'results.jtl').open(newline='',encoding='utf-8-sig') as source:
        for row in csv.DictReader(source):
            if not re_match_tx(row['label']):continue
            ts=int(row['timeStamp']);elapsed=int(row['elapsed']);idle=int(row.get('IdleTime') or 0)
            if ts>=info['steady_start_epoch_ms'] and ts+elapsed+idle<=info['steady_start_epoch_ms']+300000:
                txgroups[row['label'][3:]].append({'elapsed':elapsed,'success':row['success'].lower()=='true','bytes':int(row['bytes']),'threads':int(row['allThreads'])})
    for group,values in sorted(txgroups.items()):transactions.append({'run':run,'users':info['users'],'group':group,**mod.metrics(values)})
    level=info['users'];pooled[level]+=samples
    for x in samples:groups[(level,x['group'])].append(x)
    critical=['validated_reference_duplicates','duplicate_payment_ledger_sources','ledger_balance_mismatches','duplicate_rental_pos_financial_sources','negative_inventory_products','capital_in_operating_eligibility']
    integrity='Pass' if not info['changed_protected_tables'] and not info['invariant_changes'] and all(after['invariants'][x]==0 for x in critical) else 'Fail'
    m=summary['overall'];threshold=3000 if level in (5,10) else 5000
    latency='Pass' if m['p95_ms']<=threshold else 'Fail';errors='Pass' if m['unexpected_error_rate_percent']<=1 else 'Fail'
    group_failures=[g for g,x in summary['groups'].items() if x.get('p95_ms',float('inf'))>threshold or x.get('unexpected_error_rate_percent',float('inf'))>1]
    runs.append({'run':run,'users':level,'ramp_seconds':60,'steady_seconds':300,'samples':m['samples'],
        'successful':m['successful'],'unexpected_failed':m['unexpected_failed'],'expected_rejections':0,
        'mean_ms':m['mean_ms'],'median_ms':m['median_ms'],'min_ms':m['min_ms'],'max_ms':m['max_ms'],
        'p90_ms':m['p90_ms'],'p95_ms':m['p95_ms'],'p99_ms':m['p99_ms'],'stddev_ms':m['population_stddev_ms'],
        'throughput_http_per_second':m['throughput_http_per_second'],'error_rate_percent':m['unexpected_error_rate_percent'],
        'received_bytes':m['received_bytes'],'threads_maintained':info['threads_covering_entire_steady_window'],
        'latency_threshold_ms':threshold,'latency_result':latency,'error_result':errors,'integrity_result':integrity,
        'group_threshold_failures':';'.join(group_failures),
        'overall_result':'Pass' if latency==errors==integrity=='Pass' and not group_failures else 'Fail'})

S=E/'summaries';C=E/'charts';S.mkdir(exist_ok=True);C.mkdir(exist_ok=True)
with (S/'run-summary.csv').open('w',newline='',encoding='utf8') as f:
    writer=csv.DictWriter(f,fieldnames=list(runs[0]));writer.writeheader();writer.writerows(runs)
group_rows=[]
for run in runs:
    summary=read(E/'runs'/run['run']/'steady-summary.json')
    for g,m in summary['groups'].items():group_rows.append({'run':run['run'],'users':run['users'],'group':g,**m})
with (S/'request-group-summary.csv').open('w',newline='',encoding='utf8') as f:
    writer=csv.DictWriter(f,fieldnames=list(group_rows[0]));writer.writeheader();writer.writerows(group_rows)
with (S/'transaction-summary.csv').open('w',newline='',encoding='utf8') as f:
    writer=csv.DictWriter(f,fieldnames=list(transactions[0]));writer.writeheader();writer.writerows(transactions)
levels={}
for level in (5,10,20):
    r=[x for x in runs if x['users']==level];m=mod.metrics(pooled[level]);m['throughput_http_per_second']=len(pooled[level])/900
    levels[str(level)]={'mean_run_mean_ms':statistics.fmean(x['mean_ms'] for x in r),
       'mean_run_throughput':statistics.fmean(x['throughput_http_per_second'] for x in r),
       'mean_run_error_rate_percent':statistics.fmean(x['error_rate_percent'] for x in r),
       'run_p95_ms':[x['p95_ms'] for x in r], 'mean_run_p95_ms':statistics.fmean(x['p95_ms'] for x in r),
       'pooled_http_metrics':m,'pooled_error_rate_percent':100*sum(not x['success'] for x in pooled[level])/len(pooled[level]),
       'group_pooled_p95_ms':{f'J{i:02}':mod.metrics(groups[(level,f'J{i:02}')])['p95_ms'] for i in range(1,11)}}
group_pooled={}
for (level,group),data in groups.items():
    m=mod.metrics(data);m['throughput_http_per_second']=len(data)/900;group_pooled[f'{level}-{group}']=m
calculations={'description':'Nearest-rank percentiles from raw samples; pooled throughput uses 900 seconds at each level.',
    'runs':runs,'levels':levels,'group_pooled':group_pooled}
(S/'calculations.json').write_text(json.dumps(calculations,indent=2)+'\n',encoding='utf8')
lines=['# Acceptance results','', 'Thresholds apply to each run; group P95s must also be reviewed.','']
for r in runs:lines.append(f"- {r['run']}: P95 {r['p95_ms']} ms / {r['latency_threshold_ms']} ms: **{r['latency_result']}**; unexpected errors {r['error_rate_percent']:.3f}% / 1%: **{r['error_result']}**; integrity: **{r['integrity_result']}**; groups exceeding a threshold: {r['group_threshold_failures'] or 'none'}.")
(S/'acceptance-results.md').write_text('\n'.join(lines)+'\n',encoding='utf8')

plt.rcParams.update({'font.size':10,'axes.spines.top':False,'axes.spines.right':False,'figure.dpi':140})
colors={5:'#2c7184',10:'#da9345',20:'#9b4b50'}
def dots(field,title,ylabel,filename,threshold=False):
    fig,ax=plt.subplots(figsize=(7.5,4.3));xs=[5,10,20]
    for level in xs:
        values=[r[field] for r in runs if r['users']==level];ax.scatter([level]*3,values,color=colors[level],s=36,alpha=.8,zorder=3);ax.scatter([level],[statistics.fmean(values)],color='black',marker='D',s=40,zorder=4)
    if threshold:
        ax.plot([5,10],[3000,3000],linestyle='--',color='#555',label='Normal limit 3,000 ms');ax.scatter([20],[5000],marker='_',s=300,color='#a33232',label='Peak limit 5,000 ms');ax.legend()
    ax.set(xticks=xs,xlabel='Concurrent users',ylabel=ylabel,title=title);ax.grid(axis='y',alpha=.2);fig.tight_layout();fig.savefig(C/filename);plt.close(fig)
for args in [('mean_ms','Mean HTTP response time','Milliseconds','mean-response.png',False),('p95_ms','P95 HTTP response time','Milliseconds','p95-response.png',True),('throughput_http_per_second','HTTP throughput','Requests per second','throughput.png',False),('error_rate_percent','Unexpected error rate','Percent','error-rate.png',False)]:dots(*args)
fig,ax=plt.subplots(figsize=(10,4.5));width=.24
for offset,level in enumerate((5,10,20)):
    ax.bar([i+(offset-1)*width for i in range(10)],[levels[str(level)]['group_pooled_p95_ms'][f'J{i:02}'] for i in range(1,11)],width,label=f'{level} users',color=colors[level])
ax.set(xticks=range(10),xticklabels=[f'J{i:02}' for i in range(1,11)],xlabel='Request group',ylabel='Pooled P95 (ms)',title='Request-group P95 by concurrency');ax.legend();ax.grid(axis='y',alpha=.2);fig.tight_layout();fig.savefig(C/'groups-p95.png');plt.close(fig)
fig,ax=plt.subplots(figsize=(7.5,4.3));ax.boxplot([[x['elapsed'] for x in pooled[level]] for level in (5,10,20)],tick_labels=['5','10','20'],showfliers=False);ax.set(xlabel='Concurrent users',ylabel='Response time (ms)',title='Pooled response-time distribution (outliers omitted visually)');ax.grid(axis='y',alpha=.2);fig.tight_layout();fig.savefig(C/'distribution.png');plt.close(fig)
fig,axes=plt.subplots(3,1,figsize=(8,8),sharex=True)
for ax,level in zip(axes,(5,10,20)):
    for r in (x for x in runs if x['users']==level):
        info=read(E/'runs'/r['run']/'run.json');samples=raw_samples(E/'runs'/r['run']/'results.jtl',info['steady_start_epoch_ms']);bins=defaultdict(list)
        for x in samples:bins[min(9,(x['timestamp']-info['steady_start_epoch_ms'])//30000)].append(x['elapsed'])
        ax.plot([int(k)*30+15 for k in sorted(bins)],[statistics.fmean(bins[k]) for k in sorted(bins)],marker='.',label=r['run'])
    ax.set_ylabel('Mean ms');ax.set_title(f'{level} users');ax.grid(alpha=.2);ax.legend(ncol=3,fontsize=8)
axes[-1].set_xlabel('Seconds into steady-state window');fig.tight_layout();fig.savefig(C/'steady-trends.png');plt.close(fig)
resource=E/'resource-samples.csv'
if resource.exists():
    with resource.open(newline='',encoding='utf8') as source: observed=list(csv.DictReader(source))
    if observed:
        origin=dt.datetime.fromisoformat(observed[0]['utc']);fig,axes=plt.subplots(2,1,figsize=(9,6),sharex=True)
        for kind,color in [('api','#2c7184'),('jmeter','#da9345')]:
            rows=[x for x in observed if x['process']==kind];x=[(dt.datetime.fromisoformat(v['utc'])-origin).total_seconds()/60 for v in rows]
            axes[0].plot(x,[float(v['rss_mb']) for v in rows],label=kind,color=color,linewidth=1)
        api=[v for v in observed if v['process']=='api'][1:];x=[(dt.datetime.fromisoformat(v['utc'])-origin).total_seconds()/60 for v in api]
        axes[1].plot(x,[float(v['local_cpu_percent']) for v in api],color='#574d76',linewidth=1)
        axes[0].set(ylabel='Process RSS (MiB)',title='Local resource observations');axes[0].legend();axes[1].set(ylabel='Machine CPU (%)',xlabel='Minutes since monitoring began');axes[0].grid(alpha=.2);axes[1].grid(alpha=.2);fig.tight_layout();fig.savefig(C/'local-resources.png');plt.close(fig)
print('Compiled 9 runs, 90 group summaries, calculations and measured charts.')
