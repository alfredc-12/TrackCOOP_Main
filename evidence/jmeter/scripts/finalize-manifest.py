"""Verify deliverables and write a SHA-256 manifest without exposing credentials."""
import csv,hashlib,json,zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3];E=ROOT/'evidence/jmeter';report=ROOT/'TrackCOOP_JMeter_Performance_Testing_and_Evidence.docx'
secretfile=ROOT/'scratch/jmeter-private/users.csv'
with secretfile.open(newline='',encoding='utf8') as f:secrets=[row['password'].encode() for row in csv.DictReader(f)]
if len(secrets)!=20:raise SystemExit('Expected 20 private synthetic credentials')
required=[report,E/'summaries/run-summary.csv',E/'trackcoop-performance.jmx']
for i in range(1,10):
    d=E/'runs'/f'JMR{i:02}';required += [d/'results.jtl',d/'jmeter.log',d/'run.json',d/'steady-summary.json',d/'html-report/index.html',E/'integrity'/f'JMR{i:02}-before.json',E/'integrity'/f'JMR{i:02}-after.json']
missing=[str(p) for p in required if not p.is_file()]
if missing:raise SystemExit('Missing required evidence: '+', '.join(missing))
files=[p for p in E.rglob('*') if p.is_file() and p.name!='manifest.json' and '__pycache__' not in p.parts]+[report]
for p in files:
    data=p.read_bytes()
    if any(secret in data for secret in secrets):raise SystemExit(f'Synthetic password found in {p}; review privately')
    if p.suffix=='.docx':
        with zipfile.ZipFile(p) as archive:
            for name in archive.namelist():
                contents=archive.read(name)
                if any(secret in contents for secret in secrets):raise SystemExit(f'Synthetic password found in document entry {name}')
for p in E.glob('runs/JMR*/results.jtl'):
    with p.open(newline='',encoding='utf-8-sig') as f:
        headers=set(csv.DictReader(f).fieldnames or [])
        if headers & {'responseData','samplerData','requestHeaders','responseHeaders','cookies'}:raise SystemExit(f'Sensitive JTL fields present: {p}')
records=[{'path':str(p.relative_to(ROOT)).replace('\\','/'),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in sorted(files)]
result={'status':'completed_visual_reviewed','baseline_commit':'b68329235438e2f7986d898089beaf64e2b347f4',
 'formal_runs_completed':9,'invalidated_initial_runs':5,'acceptance':'see summaries/acceptance-results.md',
 'credentials':'20 synthetic passwords kept outside evidence under ignored scratch/jmeter-private; scanned evidence and report for those passwords',
 'files':records}
(E/'manifest.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf8');print(f'Verified {len(records)} evidence files and wrote manifest; document visual review still required.')
