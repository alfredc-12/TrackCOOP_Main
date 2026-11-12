"""Independently re-check reported HTTP statistics against original JTL files."""
import csv,json,math,statistics
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3];E=ROOT/'evidence/jmeter'
with (E/'summaries/run-summary.csv').open(newline='',encoding='utf8') as f:runs=list(csv.DictReader(f))
if len(runs)!=9:raise SystemExit('Expected nine run rows')
for r in runs:
    d=E/'runs'/r['run'];info=json.loads((d/'run.json').read_text());start=info['steady_start_epoch_ms'];samples=[]
    with (d/'results.jtl').open(newline='',encoding='utf-8-sig') as f:
        for x in csv.DictReader(f):
            if not any(x['label'].startswith(f'J{i:02} ') for i in range(1,11)):continue
            ts=int(x['timeStamp']);elapsed=int(x['elapsed'])
            if ts>=start and ts+elapsed<=start+300000:samples.append(x)
    times=sorted(int(x['elapsed']) for x in samples);n=len(times);fail=sum(x['success'].lower()!='true' for x in samples)
    if not n:raise SystemExit(f"{r['run']}: no samples")
    expected={'samples':n,'successful':n-fail,'unexpected_failed':fail,'min_ms':times[0],'max_ms':times[-1],
        'median_ms':statistics.median(times),'mean_ms':statistics.fmean(times),'p90_ms':times[math.ceil(.9*n)-1],
        'p95_ms':times[math.ceil(.95*n)-1],'p99_ms':times[math.ceil(.99*n)-1],
        'stddev_ms':statistics.pstdev(times),'throughput_http_per_second':n/300,'error_rate_percent':fail/n*100}
    for key,value in expected.items():
        if not math.isclose(float(r[key]),float(value),rel_tol=1e-10,abs_tol=1e-8):raise SystemExit(f"{r['run']}: mismatch in {key}")
    if not info['target_threads_maintained']:raise SystemExit(f"{r['run']}: target users not maintained")
    print(f"{r['run']}: {n} HTTP samples and metrics independently verified")
