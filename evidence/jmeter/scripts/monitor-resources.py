"""Sample local test processes; stop when scratch/jmeter-private/stop-monitor exists."""
import csv,datetime,os,sys,time
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT/'scratch/jmeter-private/python-packages'))
import psutil
target=ROOT/'evidence/jmeter/resource-samples.csv';stop=ROOT/'scratch/jmeter-private/stop-monitor'
if target.exists() or stop.exists():raise SystemExit('Existing monitoring output or stop flag; refusing to overwrite')
seen={};start=time.monotonic();cpus=psutil.cpu_count(logical=True)
with target.open('x',newline='',encoding='utf8') as f:
    w=csv.writer(f);w.writerow(['utc','local_cpu_percent','available_memory_mb','process','pid','process_cpu_percent_machine','rss_mb']);f.flush()
    while not stop.exists() and time.monotonic()-start<4200:
        now=time.monotonic();when=datetime.datetime.now(datetime.timezone.utc).isoformat();cpu=psutil.cpu_percent();mem=psutil.virtual_memory().available/1048576
        for p in psutil.process_iter(['name','cmdline','memory_info','cpu_times']):
            try:
                name=(p.info['name'] or '').lower();cmd=' '.join(p.info['cmdline'] or []).lower()
                kind='api' if name=='node.exe' and 'local-api.mjs' in cmd else 'jmeter' if name=='java.exe' and 'jmeter' in cmd else None
                if not kind:continue
                times=p.info['cpu_times'];total=times.user+times.system;prior=seen.get(p.pid);pct='' if not prior else max(0,(total-prior[1])/(now-prior[0])/cpus*100)
                seen[p.pid]=(now,total);w.writerow([when,cpu,round(mem,1),kind,p.pid,round(pct,3) if pct!='' else '',round(p.info['memory_info'].rss/1048576,1)])
            except (psutil.Error,TypeError):continue
        f.flush();time.sleep(5)
print('Resource monitoring stopped.')
