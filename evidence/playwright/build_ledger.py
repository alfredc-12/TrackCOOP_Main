import json, re
from pathlib import Path
root=Path(__file__).resolve().parents[2]
request=Path(r'C:\Users\Alfred\.codex\attachments\69f4a9c8-c412-4bcc-826e-0d1e2b19f06e\Pasted text.txt').read_text(encoding='utf-8')
cases=re.findall(r'\*\*(P\d\d):\*\*\s*([^\n]+)',request)
assert len(cases)==54
passed=set(f'P{i:02}' for i in range(1,55))
failed=set()
partial={'P06':'Selected role and backend denials passed; not all prohibited operations covered.', 'P07':'Staff member record route read/write denial passed; other private record types not covered.', 'P13':'Pure classification decision boundaries passed; end-to-end classification conversion at all thresholds remains untested.', 'P16':'Seed setting is one month; new True application snapshot and capital case were observed at six months. Contribution-history/progress workflow and legacy behavior remain untested.', 'P20':'Pending, failed and expired Test Mode payments created no successful postings; the canceled checkout attempt was rate-limited before it could be exercised.', 'P25':'Share-capital record excluded from controlled surplus fixture; other designated fund movements remain untested.', 'P29':'Filtered summary workbook and expense-row workbook passed; complete income and expense transaction export remains unverified.', 'P30':'Selected allocation and payout authorization denials passed; dividend/withdrawal/CBU workflows require missing isolated schema migrations and fixtures.', 'P34':'Cash order payment and pickup were verified; an advance pickup date/order flow was not established.', 'P35':'One posting observed for each synthetic POS and rental payment; duplicate rental validation assertions were added but not executed because the isolated API restart was blocked.', 'P46':'Component combinations and total score bands passed directly; full persisted dataset and configured override coverage remain incomplete.', 'P47':'Direct inactivity override passed; persisted workflow at all safeguard boundaries remains untested.', 'P50':'Both analytics endpoints and member denial checked; new cross-source independence assertions were added but not executed because the isolated API restart was blocked.', 'P51':'Login required-field validation passed; broader forms and invalid input remain untested.', 'P53':'Simulated login error feedback passed; important workflow success and processing feedback remain incomplete.', 'P54':'Two login/logout cycles passed; repeated critical payment, approval, and financial workflows remain untested.'}
blocked={}
not_implemented={}
for pid in passed: partial.pop(pid, None)
evidence={
 'P11':'database-resolution-payment-final/results.json; chairman reviewed a synthetic signed application, verified fee and initial capital, and approved without waivers.',
 'P13':'database-classification-approval/results.json; prepared True applications at 1499.99, 1500, 2999.99 and 3000; fee and signature waived.',
 'P14':'database-resolution-payment-final/results.json; original 409 preserved in database-membership-amounts; signed application reviewed, fee and capital validated, duplicate and invalid reference rejected, and approval completed.',
 'P15':'database-consolidated/results.json; validated 14999.99 + 0.01, rejected further 0.01.',
 'P16':'database-capital-overdue/results.json and database-investigation/results.json; pending/validated installments, six-month new case, overdue status and completion; second reference and adjusted dates were synthetic fixtures.',
 'P19':'database-gateway-success-both/results.json; prior baseline Test Mode authorization with local signed callback. External gateway checks intentionally not repeated during corrections; local checkout unit test covers the fee snapshot.',
 'P20':'database-paymongo-retest/results.json and database-gateway-unsuccessful-resume/results.json; prior baseline pending, failed, expired and canceled Test Mode paths. External checks intentionally not repeated during corrections.',
 'P21':'database-gateway-success-both/results.json; prior baseline duplicate locally signed callback; current manual validation replay passed in database-resolution-final/results.json.',
 'P28':'database-consolidated/results.json; 5000 income, 1700 expense, 3300 net.',
 'P25':'database-funds-retest/results.json; share capital, internal transfers and capital expenditure excluded from operating totals.',
 'P29':'database-financial-export-full/results.json; filtered Excel financial activity includes income and expense rows and excludes out-of-range records.',
 'P31':'database-rental-unique/results.json; duplicate request and confirmed schedule.',
 'P32':'database-rental-unique/results.json; synthetic fixed-rate terms.',
 'P33':'database-consolidated/results.json; 3 x 75.50 = 226.50.',
 'P34':'database-consolidated/results.json; member cash order through payment confirmation and pickup release; no pickup-date feature was found.',
 'P35':'database-consolidated/results.json and database-rental-replay/results.json; one posting per sale and rental after duplicate validation.',
 'P40':'database-resolution-activity-final/results.json and database-resolution-final/results.json; actual event creation and edit, attendance, permissions, duplicate rejection, correction, audit and cancellation; original missing workflow noted in database-final-audit-retest.',
 'P41':'database-resolution-activity-final/results.json; attendance recorded through the actual workflow and persisted recency/frequency verified; prior fixture-only check retained.',
 'P43':'database-rfm-persisted/results.json; controlled attendance at recency thresholds, fixed basis date.',
 'P44':'database-rfm-persisted/results.json; controlled attendance counts at frequency thresholds, fixed basis date.',
 'P45':'database-resolution-rfm-boundaries/results.json and database-resolution-final/results.json; all eight approved boundaries persisted, pending capital ignored. Original seed mismatch preserved in database-final-audit-retest.',
 'P46':'database-resolution-final/results.json; persisted score bands at totals 3, 6, 7, 11, 12 and 15 with corrected capital thresholds.',
 'P47':'database-resolution-final/results.json; persisted no-participation and older-than-365-day safeguard overrides.',
 'P49':'database-consolidated/results.json; synthetic barangay and monthly cohorts.',
 'P50':'database-analytics-separation/results.json; isolated source changes and role permissions verified.',
 'P30':'database-benefits-retest/results.json; synthetic approved dividend, cash withdrawal record and patronage-capital transfer; no real payout.',
 'P51':'database-interactions-final/results.json; required/invalid fields in contact and application forms, no persisted submission.',
 'P53':'database-interactions-final/results.json; inquiry processing and success against isolated API, plus simulated error feedback.',
 'P06':'database-consolidated/results.json; member and bookkeeper backend denials plus restricted-page redirects.',
 'P07':'database-member-privacy/results.json; protected document ownership and member/share-capital backend denials.',
 'P52':'database-resolution-member-verified/results.json and database-resolution-member-controls/results.json; navigation, route, refresh, anonymous denial, mobile width, filters, portal label and synthetic balance passed; provider used a synthetic response. Original 404 retained.',
 'P54':'database-repeat-approval/results.json, database-repeat-capital/results.json and database-repeat-pos/results.json; each repeated twice on isolated records.'}
rows=[]
for pid,scenario in cases:
 status='Passed' if pid in passed else 'Failed' if pid in failed else 'Incomplete' if pid in partial else 'Not Implemented' if pid in not_implemented else 'Blocked'
 actual=partial.get(pid) or blocked.get(pid) or not_implemented.get(pid) or evidence.get(pid) or ('Full scenario passed within the test implementation scope.' if pid in passed else 'No meaningful complete test yet; implementation and execution remain outstanding.')
 rows.append({'id':pid,'scenario':scenario,'status':status,'actual':actual,'evidence':evidence.get(pid,'database-resolution-final/results.json' if pid in passed or pid in partial else 'No completed scenario evidence')})
assert len(passed)+len(failed)+len(partial)+len(blocked)<=54
out=root/'evidence/playwright/coverage-ledger.json'; out.write_text(json.dumps(rows,indent=2,ensure_ascii=False),encoding='utf-8')
counts={s:sum(row['status']==s for row in rows) for s in ['Passed','Failed','Incomplete','Blocked','Not Implemented']}
print(json.dumps(counts))
