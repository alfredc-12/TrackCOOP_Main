"""Run nine independent CLI tests; preserve every run and stop on setup failure."""
import csv
import datetime as dt
import json
import os
import re
import subprocess
import sys
from pathlib import Path
from urllib.request import Request, urlopen

ROOT=Path(__file__).resolve().parents[3]
os.chdir(ROOT)
EVIDENCE=ROOT/'evidence/jmeter'
JMETER=ROOT/'scratch/jmeter-distribution/verified/apache-jmeter-5.6.3/bin/jmeter.bat'
JRE=next((ROOT/'scratch/jmeter-distribution/java17').iterdir())
ENV=os.environ.copy();ENV['JAVA_HOME']=str(JRE);ENV['PATH']=str(JRE/'bin')+os.pathsep+ENV['PATH']
ENV['PYTHONUNBUFFERED']='1'
MATRIX=[(f'JMR{i:02}',5 if i<=3 else 10 if i<=6 else 20) for i in range(1,10)]

def snapshot(label, target):
    with target.open('w',encoding='utf-8') as out:
        result=subprocess.run(['node',str(EVIDENCE/'scripts/integrity.cjs'),label],stdout=out,stderr=subprocess.STDOUT,env=ENV)
    if result.returncode: raise RuntimeError(f'Integrity snapshot {label} failed: see {target}')
    return json.loads((EVIDENCE/'integrity'/f'{label}.json').read_text(encoding='utf-8'))

def health():
    req=Request('http://127.0.0.1:3218/api/health',headers={'X-JMeter-Slot':'1'})
    with urlopen(req,timeout=20) as response:
        if response.status!=200: raise RuntimeError('API health check failed')

for run,users in MATRIX:
    target=EVIDENCE/'runs'/run
    if target.exists(): raise SystemExit(f'Refusing to overwrite {target}')
    target.mkdir(parents=True)
    print(f'{run}: checking environment and recording pre-run integrity',flush=True)
    health()
    before=snapshot(run+'-before',target/'integrity-before.log')
    cmd=['cmd.exe','/d','/c',str(JMETER),'-n','-t',str(EVIDENCE/'trackcoop-performance.jmx'),
        '-l',str(target/'results.jtl'),'-j',str(target/'jmeter.log'),'-Jusers='+str(users),'-Jramp=60',
        '-Jduration=365','-e','-o',str(target/'html-report')]
    start=dt.datetime.now(dt.timezone.utc).isoformat()
    print(f'{run}: starting {users} users, 60 s ramp, 300 s measurement, 5 s tail',flush=True)
    with (target/'console.log').open('w',encoding='utf-8',errors='replace') as output:
        completed=subprocess.run(cmd,stdout=output,stderr=subprocess.STDOUT,env=ENV)
    end=dt.datetime.now(dt.timezone.utc).isoformat()
    after=snapshot(run+'-after',target/'integrity-after.log')
    text=(target/'console.log').read_text(encoding='utf-8',errors='replace')
    match=re.search(r'Starting standalone test\s*@.*?\((\d{13})\)',text)
    if not match: raise RuntimeError(f'{run}: JMeter test start timestamp missing; preserve run and inspect')
    window_start=int(match.group(1))+60000
    summary=target/'steady-summary.json'
    rc=subprocess.run([sys.executable,str(EVIDENCE/'scripts/summarize.py'),str(target/'results.jtl'),str(window_start),str(summary)],env=ENV)
    if rc.returncode: raise RuntimeError(f'{run}: summary failed')
    stats=json.loads(summary.read_text(encoding='utf-8'))
    lifecycle={}
    log=(target/'jmeter.log').read_text(encoding='utf-8',errors='replace')
    for line in log.splitlines():
        event=re.match(r'^(\d{4}-\d\d-\d\d \d\d:\d\d:\d\d,\d{3}).*Thread (started|finished): (.+)$',line)
        if event:
            timestamp=dt.datetime.strptime(event.group(1),'%Y-%m-%d %H:%M:%S,%f').replace(tzinfo=dt.timezone(dt.timedelta(hours=8)))
            lifecycle.setdefault(event.group(3),{})[event.group(2)]=int(timestamp.timestamp()*1000)
    covered=sum(v.get('started',window_start+1)<=window_start and v.get('finished',0)>=window_start+300000 for v in lifecycle.values())
    changed=[table for table in before['tables'] if before['tables'][table]!=after['tables'].get(table)]
    invariant_changes={k:[v,after['invariants'].get(k)] for k,v in before['invariants'].items() if v!=after['invariants'].get(k)}
    missing=[k for k,v in stats['groups'].items() if not v['samples']]
    info={'run':run,'users':users,'ramp_seconds':60,'steady_seconds':300,'extra_tail_seconds':5,
        'command_start_utc':start,'command_end_utc':end,'jmeter_start_epoch_ms':int(match.group(1)),
        'steady_start_epoch_ms':window_start,'jmeter_exit_code':completed.returncode,
        'missing_groups':missing,'changed_protected_tables':changed,'invariant_changes':invariant_changes,
        'html_report_exists':(target/'html-report/index.html').is_file(),
        'threads_covering_entire_steady_window':covered,'thread_lifecycles':lifecycle,
        'target_threads_maintained':covered==users}
    (target/'run.json').write_text(json.dumps(info,indent=2)+'\n',encoding='utf-8')
    print(f"{run}: samples={stats['overall']['samples']} failures={stats['overall'].get('unexpected_failed')} p95={stats['overall'].get('p95_ms')} ms; protected table changes={changed}",flush=True)
    if completed.returncode or missing or not info['html_report_exists'] or not info['target_threads_maintained']:
        raise RuntimeError(f'{run}: incomplete test setup; inspect preserved evidence before proceeding')
    if changed or invariant_changes:
        raise RuntimeError(f'{run}: protected database state changed; investigation required')
print('All nine formal executions completed; validate concurrency and calculate acceptance separately.',flush=True)
