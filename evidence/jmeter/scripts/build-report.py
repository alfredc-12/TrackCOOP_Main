"""Build the Word report only after complete, verified summaries exist."""
import csv,json,math,statistics,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3];E=ROOT/'evidence/jmeter';S=E/'summaries';C=E/'charts'
from docx import Document
from docx.enum.section import WD_ORIENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches,Pt,RGBColor

data=json.loads((S/'calculations.json').read_text(encoding='utf8'));runs=data['runs'];levels=data['levels']
if len(runs)!=9 or any(not (E/'runs'/r['run']/'run.json').exists() for r in runs):raise SystemExit('Nine verified runs required')
with (S/'request-group-summary.csv').open(newline='',encoding='utf8') as f: group_rows=list(csv.DictReader(f))
with (S/'transaction-summary.csv').open(newline='',encoding='utf8') as f: tx_rows=list(csv.DictReader(f))
if len(group_rows)!=90:raise SystemExit('Expected 90 group summaries')
doc=Document();sec=doc.sections[0];sec.orientation=WD_ORIENT.LANDSCAPE;sec.page_width,sec.page_height=Inches(11.69),Inches(8.27);sec.top_margin=sec.bottom_margin=Inches(.5);sec.left_margin=sec.right_margin=Inches(.7)
normal=doc.styles['Normal'];normal.font.name='Calibri';normal.font.size=Pt(10);normal.paragraph_format.space_after=Pt(5)
for n in ['Title','Heading 1','Heading 2']:
    st=doc.styles[n];st.font.name='Calibri';st.font.color.rgb=RGBColor.from_string('1B4C55')
footer=sec.footer.paragraphs[0];footer.alignment=WD_ALIGN_PARAGRAPH.RIGHT;footer.add_run('TrackCOOP performance evaluation  |  ')
field=OxmlElement('w:fldSimple');field.set(qn('w:instr'),'PAGE');footer._p.append(field)
def p(text,style=None):return doc.add_paragraph(str(text),style)
def heading(text,level=1):doc.add_heading(text,level=level)
def table(headers,rows,size=8):
    t=doc.add_table(rows=1,cols=len(headers));t.style='Light Shading Accent 1';t.autofit=True
    for cell,value in zip(t.rows[0].cells,headers):cell.text=str(value)
    trPr=t.rows[0]._tr.get_or_add_trPr();repeat=OxmlElement('w:tblHeader');repeat.set(qn('w:val'),'true');trPr.append(repeat)
    for values in rows:
        cells=t.add_row().cells
        for cell,value in zip(cells,values):cell.text=str(value)
    for row in t.rows:
        for cell in row.cells:
            for par in cell.paragraphs:
                par.paragraph_format.space_after=Pt(1)
                for run in par.runs:run.font.size=Pt(size)
    return t
def f(x,n=2):return f'{float(x):,.{n}f}'
def figure(name,caption,explanation):
    doc.add_picture(str(C/name),width=Inches(5.4 if name=='steady-trends.png' else 8.0))
    doc.paragraphs[-1].paragraph_format.keep_with_next=True
    cap=p(caption,'Caption');cap.paragraph_format.keep_with_next=True
    p(explanation)

doc.add_heading('TrackCOOP',0);p('Apache JMeter Performance Testing and Evidence','Subtitle');p('Development-environment evaluation | 8 November 2026 (Asia/Manila)')
p('Baseline Git revision: b68329235438e2f7986d898089beaf64e2b347f4 (main). This report records nine independently executed repetitions and refers to the original JTL and dashboard files for detailed evidence.')
heading('1. Testing overview')
p('The evaluation measured HTTP response time, throughput, unexpected request errors and selected financial-data invariants for representative TrackCOOP workflows under 5, 10 and 20 concurrent virtual users. The evaluation used the owner-confirmed dummy development database. It did not exercise live or test payment transactions, external webhooks, real email, financial payouts or withdrawal operations.')
p('ISO/IEC 25010:2023 provides a product-quality model and a context for performance efficiency. These short tests chiefly measure time behaviour for the selected workload; they do not establish all aspects of product quality, long-term reliability, or production capacity. Source: ISO, https://www.iso.org/standard/78176.html.')
heading('2. Environment and topology')
table(['Component','Observed configuration'],[
('Computer','HP Victus 15-fb3xxx; AMD Ryzen 5 7535HS, 12 logical processors; 16 GiB installed RAM'),
('Operating system and storage','Windows 11 Home Single Language 64-bit, build 10.0.26300; 512 GB fixed disk; storage throughput not measured'),
('Load generator and application','Apache JMeter 5.6.3, Eclipse Temurin JRE 17.0.21+9; Node.js 24.15.0 / Express 5.2.1. Load generator and API shared the laptop.'),
('Frontend','Next.js 16.2.10 / React 19.2.4; browser rendering was not measured.'),
('Database','Owner-confirmed dummy development schema on remote AWS RDS MySQL 8.4.9. The configured development connection had TLS disabled; database processing and network latency contribute to HTTP times.'),
('Controls','API bound to 127.0.0.1; selected GET endpoints and login only; PayMongo disabled, external email disabled, local storage, outbound connections restricted to the development database.'),
('Fixtures','20 unique JMeter identities: 4 chairmen, 4 bookkeepers and 12 approved true members; distinct cookie sessions; 5-user role pattern repeated at higher levels.')],9)
p('The monitored local API and load generator shared resources. Remote MySQL resource utilization, database-pool saturation and disk performance were not observed. Local process monitoring is sampled, not continuous. These measurements describe the tested topology, not a production deployment.')
resource_file=E/'resource-samples.csv'
if resource_file.exists():
    with resource_file.open(newline='',encoding='utf8') as source: resource=[x for x in csv.DictReader(source) if x['process']=='api']
    if len(resource)>1:
        memory=[float(x['available_memory_mb']) for x in resource];cpu=[float(x['local_cpu_percent']) for x in resource[1:]]
        p(f"During local monitoring, available physical memory ranged from {f(min(memory),1)} to {f(max(memory),1)} MiB and sampled total-machine CPU ranged from {f(min(cpu),1)}% to {f(max(cpu),1)}%. These values are contextual observations rather than proof of a bottleneck.")
heading('3. Test design and safeguards')
p('A single thread group used the total user count shown in the run matrix. Each user logged in once with a unique synthetic account, then followed a role-appropriate fixed sequence with two seconds of think time per HTTP request. Each run used a 60-second ramp, a 300-second steady-state window and a five-second excluded tail. Only samples beginning and finishing within the steady window are included in the formal metrics. Thread start and finish logs were used to verify that the intended user count covered the full window.')
p('The existing per-IP global and login rate limiters remained enabled. A restricted local gateway overwrote the forwarded address with a distinct reserved benchmarking address for each synthetic slot, so virtual users did not all share one apparent IP. This test-only trusted-proxy arrangement differs from the ordinary application topology. Earlier one-second pacing produced 429 responses during a third repeated run after prior tests; its five-minute window had 344 unexpected failures among 1,190 HTTP samples. These setup runs are retained but invalidated for formal acceptance because unused payment credentials could be reloaded into the process. Two-second pacing was selected for the fresh matrix to stay below the 500-per-15-minute per-IP limit without changing it. The resulting metrics do not describe sustained one-second pacing. JSON shape, success fields, expected HTTP status and authenticated identity were asserted; expected 4xx tests were separate from formal traffic.')
p('Login creates session and audit records. The dashboard can initialize a missing referral code; those codes were initialized only on the test-owned profiles before formal baselines. Financial writes, checkout, refunds, withdrawals and payouts were excluded. Integrity checks compare counts and MySQL table checksums, selected totals and duplicate or negative-stock indicators before and after each run. Checksums provide evidence of unchanged selected tables, not a complete accounting audit.')
heading('4. Request-group matrix')
mapping=[('J01','Public information','GET /api/public/landing','Any','Success envelope'),('J02','Authentication','GET /api/auth/me','Authenticated','Response email matches session identity'),('J03','Member dashboard','GET /api/members/me/dashboard','True member','Linked true-member dashboard'),('J04','Membership','GET /api/membership-applications','Staff','Success envelope'),('J05','Share capital','GET /api/members/me/share-capital/overview; GET /api/members/me/share-capital/transactions','True member','Owner, reconciliation and transaction IDs'),('J06','Finance','GET /api/financial-records; GET /api/financial-records/summary','Staff','Success envelopes'),('J07','Analytics','GET /api/chairman/member-analytics; GET /api/chairman/financial-analytics','Chairman','Success envelopes'),('J08','Rental scheduling','GET /api/rental/schedules','Staff','JSON array'),('J09','Inventory and sales','GET /api/inventory; GET /api/pos/orders','Staff','JSON arrays'),('J10','Communications and activities','GET /api/documents; GET /api/announcements; GET /api/activities','Staff','Documents list and success envelopes')]
table(['ID','Module','Route(s)','Role','Expected response'],mapping,8)
p('The mapping was derived from implemented routes; no exact approved Chapter III mapping was found in the repository. These GET requests have no request body and use default query parameters. J01 is public; each other route uses an authenticated synthetic account with the listed role. Assertions require HTTP 200, the response shape listed above, and applicable owner or reconciliation checks. All are read requests apart from the documented dashboard referral initialization. Repetition safety is supported by the restricted gateway, per-user identities and the before/after checks, not assumed for financial writes. Multi-request workflows have separate TX_Jxx transaction summaries; the following HTTP statistics exclude those transaction summary samples and setup login.')
heading('5. Formal execution results')
table(['Run','Users','HTTP n','Success','Failed','Mean ms','P95 ms','HTTP/s','Error %','Integrity','Disposition'],[(r['run'],r['users'],r['samples'],r['successful'],r['unexpected_failed'],f(r['mean_ms']),r['p95_ms'],f(r['throughput_http_per_second']),f(r['error_rate_percent']),r['integrity_result'],r['overall_result']) for r in runs],8)
p('Disposition also considers each request group against the applicable P95 and error thresholds. A run can therefore have an acceptable overall P95 while a critical group exceeds the threshold. Expected rejection count is zero for the formal workload.')
heading('6. Results by user level')
table(['Users','Mean of run means (ms)','Pooled P95 (ms)','Mean throughput (HTTP/s)','Pooled errors (%)','Run P95 values (ms)'],[(k,f(v['mean_run_mean_ms']),v['pooled_http_metrics']['p95_ms'],f(v['mean_run_throughput']),f(v['pooled_error_rate_percent']),', '.join(map(str,v['run_p95_ms']))) for k,v in levels.items()],9)
for level in ('5','10','20'):
    v=levels[level];p(f"At {level} users, the three-run mean of run-level mean response times was {f(v['mean_run_mean_ms'])} ms; pooled P95 was {v['pooled_http_metrics']['p95_ms']} ms; mean HTTP throughput was {f(v['mean_run_throughput'])} requests/s; and pooled unexpected error rate was {f(v['pooled_error_rate_percent'])}%.")
heading('7. Results by request group')
rows=[]
for i in range(1,11):
    g=f'J{i:02}';row=[g]
    for level in (5,10,20):
        m=data['group_pooled'][f'{level}-{g}'];row.extend([m['samples'],f(m['mean_ms']),m['p95_ms'],f(m['unexpected_error_rate_percent'])])
    rows.append(row)
table(['Group','5 n','5 mean','5 P95','5 err%','10 n','10 mean','10 P95','10 err%','20 n','20 mean','20 P95','20 err%'],rows,7)
p('Group means and P95s above pool the underlying HTTP samples across the three repetitions at each user level. Different role sequences and response times produce different sample counts. The detailed per-run group values appear in the appendix.')
heading('Workflow transaction throughput',2)
tx_table=[]
for i in range(1,11):
    group=f'J{i:02}';row=[group]
    for level in (5,10,20):
        sample_count=sum(int(x['samples']) for x in tx_rows if x['group']==group and int(x['users'])==level)
        row.append(f'{sample_count} / {sample_count/900:.3f}')
    tx_table.append(row)
table(['Group','5 users: completions / sec','10 users: completions / sec','20 users: completions / sec'],tx_table,8)
p('These are JMeter workflow transaction samples, counted separately from HTTP requests over the three 300-second windows. They do not represent completed payments, sales or other financial business transactions. Transaction elapsed time excludes configured think time; a transaction is included only if its full wall-clock interval, including idle time, lies in the window.')
for level in (5,10,20):
    pairs=[(data['group_pooled'][f'{level}-J{i:02}']['p95_ms'],f'J{i:02}') for i in range(1,11)];slow=max(pairs);fast=min(pairs);p(f'At {level} users, {slow[1]} had the highest pooled group P95 ({slow[0]} ms); {fast[1]} had the lowest ({fast[0]} ms). These describe this workload and do not isolate a root cause.')
heading('8. Calculations and interpretation')
r=runs[0];p('Mean response time = sum of HTTP sample elapsed times / number of HTTP samples. Throughput = completed HTTP samples / 300 seconds. Unexpected error rate = failed applicable HTTP samples / applicable HTTP samples × 100. P95 uses the nearest-rank observation at ceil(0.95 × n), sorted in ascending order. Percentiles are computed from raw samples; group percentiles are not averaged to obtain an overall percentile.')
p(f"Worked example, {r['run']}: {r['samples']:,} samples / 300 seconds = {f(r['throughput_http_per_second'],3)} HTTP requests/s; {r['unexpected_failed']} / {r['samples']:,} × 100 = {f(r['error_rate_percent'],3)}%. The sample mean is {f(r['mean_ms'])} ms, and nearest-rank P95 is observation {math.ceil(.95*r['samples']):,} of the sorted observations, or {r['p95_ms']} ms.")
p('The mean of three run-level means gives each repetition equal weight. The pooled error rate uses the total failed samples divided by the total applicable samples; pooled P95 is calculated from the combined samples. These summaries are distinct from an average of three P95 values.')
p('The complete-within-window rule excludes requests still in progress at the end of the five-minute window. In JMR09, 15 HTTP requests started within the window but finished after it; their eventual elapsed times reached 37,858 ms and none was marked failed. Excluding these long requests can bias the reported JMR09 steady-window latency downward. Their original samples remain in the JTL. This boundary rule was chosen before formal execution and applied consistently to all runs.')
heading('9. Graphical analysis')
figs=[('mean-response.png','Figure 1. Mean HTTP response time by user level.','Dots are individual runs; black diamonds are the arithmetic means of the three run means.'),('p95-response.png','Figure 2. P95 response time and acceptance thresholds.','Each dot is a run; the thresholds apply to the relevant user levels.'),('throughput.png','Figure 3. HTTP throughput by user level.','Throughput counts HTTP samples over the 300-second window, excluding transaction summaries.'),('error-rate.png','Figure 4. Unexpected HTTP error rate.','Failures include HTTP and assertion failures; formal traffic contains no expected rejection samples.'),('groups-p95.png','Figure 5. Pooled request-group P95 by user level.','Each group percentile is calculated from the underlying three-run sample pool for that level.'),('distribution.png','Figure 6. Pooled HTTP response-time distributions.','Box plots omit outliers visually; all observations remain in the numerical calculations.'),('steady-trends.png','Figure 7. Thirty-second steady-state mean response-time trends.','Each line represents one formal repetition; bins contain actual samples and may contain different counts.')]
for args in figs:figure(*args)
if (C/'local-resources.png').exists():
    figure('local-resources.png','Figure 8. Local CPU and process memory observations.','The database ran remotely, and its resource utilization was not observed. CPU is the share of total local machine capacity; RSS is resident memory.')
heading('10. Data-integrity and reliability observations')
p('Before and after each run, aggregate counts and table checksums were captured for membership profiles, share-capital accounts, payments and ledger, financial records and categories, payment references, products, inventory movements, sales and rental records. Additional queries checked duplicate validated payment references, duplicate payment-ledger sources, ledger balance mismatches, duplicate active approved rental/POS financial sources, negative inventory, and overlap between the application’s own operating-eligibility and capital-movement predicates. Ten active, approved income-type records were tagged as share capital at preflight; their income-type label alone does not mean they enter operating income, because the application rule excludes capital movements. These are targeted checks rather than proof of all accounting invariants or every report view.')
p('JMR08 recorded a rental-schedules HTTP 500 and JMR09 recorded a share-capital overview HTTP 500. API diagnostics identified connection resets during database-backed authentication and true-member checks respectively; the initiating cause of the resets was not determined. JMR09 also recorded socket timeouts. These failures remain in the raw evidence and applicable error-rate calculations.')
table(['Run','Protected table or invariant changes','Integrity'],[(r['run'],'None observed' if r['integrity_result']=='Pass' else 'See per-run integrity evidence',r['integrity_result']) for r in runs],9)
p('The identity endpoint checks each session against its assigned synthetic account. The share-capital overview checks the synthetic member code and the transaction assertion checks returned owner IDs; synthetic members have empty ledger histories, so the latter check is vacuous when the list is empty. This does not comprehensively prove absence of cross-member exposure for every field or endpoint. Five minutes of steady load cannot establish long-duration reliability.')
heading('11. Acceptance evaluation')
table(['Criterion','Threshold','Run-level result'],[('Normal-load overall P95','≤ 3,000 ms at 5 and 10 users',', '.join(f"{r['run']} {r['latency_result']}" for r in runs if r['users'] in (5,10))),('Peak-load overall P95','≤ 5,000 ms at 20 users',', '.join(f"{r['run']} {r['latency_result']}" for r in runs if r['users']==20)),('Unexpected HTTP error rate','≤ 1% per run',', '.join(f"{r['run']} {r['error_result']}" for r in runs)),('Selected critical data integrity','Zero observed failures',', '.join(f"{r['run']} {r['integrity_result']}" for r in runs))],8)
failed_groups=[f"{r['run']}: {r['group_threshold_failures']}" for r in runs if r['group_threshold_failures']]
p('Groups exceeding the applicable P95 or 1% error threshold: '+('; '.join(failed_groups) if failed_groups else 'none observed')+'. The group check is reported separately so an overall pass cannot hide slower critical operations.')
heading('12. Limitations and recommendations')
p('The local load generator and API competed for laptop resources; the database was remote, the connection was unencrypted, and remote database resource and query-plan telemetry was unavailable. Synthetic accounts and fixed pacing are not a measurement of production usage. Pre-run integrity scans may warm database caches, so this is not a cold-start evaluation. Rate limits saw synthetic per-user IPs through a test-only proxy setting. The workload excludes payments and financial writes, uses short repetitions and does not measure browser rendering, endurance or recovery.')
if failed_groups:p('Investigate the request groups listed above using database query plans, connection-pool telemetry and server profiling under a comparable workload. The current measurements identify latency symptoms but do not establish a specific root cause.')
else:p('Continue to monitor critical analytics and financial reads under longer, independently generated workloads before drawing capacity conclusions. No specific bottleneck is established by these measurements alone.')
p('Review available memory and isolate the load generator in a future evaluation. Retest any optimization as a separately labeled evaluation without replacing these baseline measurements.')
heading('Appendix A. Detailed request-group results')
for level in (5,10,20):
    heading(f'{level} concurrent users',2)
    rows=[x for x in group_rows if int(x['users'])==level]
    table(['Run','Group','n','Success','Failed','Mean ms','P50','P90','P95','P99','HTTP/s','Error %'],[(r['run'],r['group'],r['samples'],r['successful'],r['unexpected_failed'],f(r['mean_ms']),r['median_ms'],r['p90_ms'],r['p95_ms'],r['p99_ms'],f(r['throughput_http_per_second']),f(r['unexpected_error_rate_percent'])) for r in rows],7.5)
heading('Appendix B. Procedure and evidence')
p('Original JTL, JMeter logs, per-run JSON, HTML dashboards and pre/post integrity snapshots are retained under evidence/jmeter/runs/JMR01 through JMR09 and evidence/jmeter/integrity. The request-group summary, calculations JSON and charts are under evidence/jmeter/summaries and evidence/jmeter/charts. The CSV run-summary is the companion numerical deliverable.')
p('Reproduction requires an owner-authorized dummy database, separately created synthetic accounts, the restricted local launcher and verified JMeter 5.6.3 with Java 17. Review the safeguards and configuration before running. The command pattern is: jmeter -n -t evidence/jmeter/trackcoop-performance.jmx -l <new-run>/results.jtl -j <new-run>/jmeter.log -Jusers=<5|10|20> -Jramp=60 -Jduration=365 -e -o <new-run>/html-report. The run-formal.py driver performs pre/post snapshots and derives the steady window from the logged JMeter start time. Never target a production database or active external integration.')
p('Calibration CAL01 and CAL02 were invalidated by Java/Groovy and role-condition setup issues. CAL03 exercised all ten groups, and CAL04 deliberately demonstrated a failing status assertion. After the launcher correction, CAL06 exercised all groups with matching protected-table checks; CAL07 failed to generate its negative-test plan, and CAL08 deliberately demonstrated a failing member-ownership assertion. Three initial one-second executions were invalidated because credentials could be reloaded, and two subsequent two-second executions were invalidated because two financial integrity queries used an incorrect status. All five remain under evidence/jmeter/invalidated. Before these runs the inspected additive activity migration was applied to the confirmed dummy database; its existing activity and attendance row counts were unchanged.')
doc.paragraphs[-1].add_run(' References: ISO/IEC 25010:2023, https://www.iso.org/standard/78176.html; Apache JMeter user manual, https://jmeter.apache.org/usermanual/; repository evidence/jmeter/methodology.md and environment.md.')
output=ROOT/'TrackCOOP_JMeter_Performance_Testing_and_Evidence.docx';doc.save(output);print(f'Wrote {output}')
