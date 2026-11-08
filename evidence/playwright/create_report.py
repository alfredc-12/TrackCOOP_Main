from pathlib import Path
import re, json
from datetime import datetime
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

root = Path(__file__).resolve().parents[2]
request = Path(r'C:\Users\Alfred\.codex\attachments\69f4a9c8-c412-4bcc-826e-0d1e2b19f06e\Pasted text.txt').read_text(encoding='utf-8')
cases = re.findall(r'\*\*(P\d\d):\*\*\s*([^\n]+)', request)
assert len(cases) == 54 and len(set(x[0] for x in cases)) == 54
inventory_text = request.split('### A. Public and authentication interfaces', 1)[1].split('This is a **candidate screenshot inventory**', 1)[0]
inventory = re.findall(r'^\d+\.\s+(.+)$', inventory_text, re.M)
assert len(inventory) == 50
doc = Document()
sec = doc.sections[0]
sec.top_margin = sec.bottom_margin = Inches(.7)
sec.left_margin = sec.right_margin = Inches(.8)
styles = doc.styles
styles['Normal'].font.name = 'Calibri'
styles['Normal'].font.size = Pt(10)
for n in ['Title', 'Heading 1', 'Heading 2']:
    styles[n].font.color.rgb = RGBColor(0, 0, 0)
footer = sec.footer.paragraphs[0]
footer.alignment = WD_ALIGN_PARAGRAPH.CENTER
footer.add_run('TrackCOOP evidence report  |  ')
field = OxmlElement('w:fldSimple'); field.set(qn('w:instr'), 'PAGE'); footer._p.append(field)
def para(text): doc.add_paragraph(text)
def table(headers, rows):
    t = doc.add_table(rows=1, cols=len(headers)); t.style = 'Light Shading Accent 1'
    for c, x in zip(t.rows[0].cells, headers): c.text = str(x)
    header_props=t.rows[0]._tr.get_or_add_trPr(); header_props.append(OxmlElement('w:tblHeader'))
    for row in rows:
        row_obj = t.add_row(); row_obj._tr.get_or_add_trPr().append(OxmlElement('w:cantSplit')); cells = row_obj.cells
        for c, x in zip(cells, row): c.text = str(x)
    return t
def module(i):
    return ('Authentication and access' if i<=8 else 'Membership and share capital' if i<=18 else 'Payments and finance' if i<=30 else 'Rental and sales' if i<=35 else 'Documents and communication' if i<=42 else 'Member analytics' if i<=50 else 'Interaction and repeatability')
def quality(i): return 'Interaction capability' if i in (51,52,53) else 'Reliability' if i==54 else 'Functional suitability'
ledger = {row['id']:row for row in json.loads((root/'evidence/playwright/coverage-ledger.json').read_text(encoding='utf-8'))}
counts = {status:sum(row['status']==status for row in ledger.values()) for status in ('Passed','Failed','Incomplete','Blocked','Not Implemented')}
critical_passed = sum(ledger[f'P{i:02}']['status']=='Passed' for i in list(range(1,51))+[54])
def outcome(pid):
    row=ledger[pid]
    return row['status']+' — '+row['actual']+' Evidence: '+row['evidence']
title = doc.add_heading('TrackCOOP Playwright Testing and Screenshot Evidence', 0)
title_pr=title._p.get_or_add_pPr(); borders=OxmlElement('w:pBdr'); bottom=OxmlElement('w:bottom'); bottom.set(qn('w:val'),'nil'); borders.append(bottom); title_pr.append(borders)
para('Evidence report for academic review | 8 November 2026 | Asia Manila')
para(f"All 54 proposed scenarios have a documented disposition. A verified disposable local MySQL instance and synthetic role accounts supported database-backed tests. {counts['Passed']} scenarios passed within the stated scope, {counts['Failed']} failed, {counts['Incomplete']} remain incomplete, {counts['Blocked']} are blocked, and {counts['Not Implemented']} workflow was not found in the implementation. Partial checks are not counted as full passes.")
doc.add_heading('1 Testing Overview', 1)
para('The proposed coverage concerns functional suitability, selected observable interaction capability, and short-run repeatability. Playwright cannot establish subjective satisfaction, perceived usability, learnability, or long-term operational reliability. Specific Objective numbers were not supplied in the request and the thesis was not inspected; mappings need academic confirmation. Requirements below refer to the numbered proposed scenarios.')
doc.add_heading('2 Test Environment', 1)
table(['Item','Observed or limitation'], [
 ('Date and time','8 November 2026, Asia/Manila'), ('Branch','feature/section3-financial-evidence-1e'), ('Baseline and retest','Baseline commit d9a7240d6f720636602df9418d722d9bff460d2b; corrective retest used the uncommitted working tree on that commit.'), ('Application','TrackCOOP package 0.1.0; Next.js 16.2.10 frontend; Express and MySQL backend'), ('Playwright','1.61.1; Chromium headless shell revision 1228; exact browser version not captured'), ('Host','Windows; frontend 127.0.0.1:3217; isolated API 127.0.0.1:3218'), ('Isolation','MySQL 8.4.3 on loopback port 33327; verified workspace data directory and synthetic database. API uses disabled email, disabled PayMongo and local storage.'), ('Fixtures','Project schema and synthetic seed, with test-only configuration updates and additive activity management migration. Three roles and synthetic records.'), ('Command','npx.cmd playwright test --config playwright.database-evidence.config.ts; external PayMongo opt-ins unset.'), ('Evidence','database-resolution-final contains consolidated HTML and JSON results; earlier failures, original reports and individual retests are preserved. coverage-ledger.json is the case-level source of truth.')])
doc.add_heading('3 Test Coverage Matrix', 1)
para('P01–P50 and P54 are provisionally critical; P51–P53 are selected interaction checks. A partial check can establish a mismatch, but a passing partial check is not a full scenario pass. Review actual test code and individual evidence for exact roles, routes, fixture conditions and assertions.')
table(['ID / characteristic','Requirement and module','Status / evidence'], [(pid+'\n'+quality(i), text+'\n'+module(i), outcome(pid)) for i,(pid,text) in enumerate(cases,1)])
doc.add_heading('4 Playwright Execution Summary', 1)
run_stats=json.loads((root/'evidence/playwright/database-resolution-final/results.json').read_text(encoding='utf-8'))['stats']
table(['Measure','Count or result'], [('Proposed scenarios','54'),('Passed / failed / incomplete / blocked / not implemented',f"{counts['Passed']} / {counts['Failed']} / {counts['Incomplete']} / {counts['Blocked']} / {counts['Not Implemented']}"),('Initial disposition','50 passed, 3 failed (P14, P45, P52), 1 not implemented (P40). Historical evidence retained.'),('Current consolidated Playwright run',f"{run_stats['expected']} passed, {run_stats['unexpected']} failed, {run_stats['skipped']} skipped. Test counts are not scenario counts."),('PayMongo limitation','Three external Test Mode tests deliberately skipped during corrective work because the webhook was disabled. Previous Test Mode and local signed-callback evidence is retained; no external webhook delivery was established.'),('Critical functional outcome',f'{critical_passed} of 51 provisionally critical cases passed ({critical_passed/51*100:.1f}%); the denominator is all planned critical cases.'),('Interaction workflows','P51 validation, P52 corrected member navigation and responsive route, and P53 processing and feedback passed within the recorded test scope.')])
para('The prior P14 fee rejection, P45 seed thresholds, P52 route 404, and missing P40 workflow were investigated and corrected. The legacy deadline test setting was corrected to six months in the synthetic seed and isolated database. Historical failures remain available in their original results. The current results combine local corrective tests with preserved earlier Test Mode evidence. After the consolidated run, the member page layout and shared dropdowns were refined and retested separately, including a provider control with a synthetic response.')
doc.add_heading('5 Functional Suitability Findings', 1)
para('Synthetic authentication, applications and approval were checked. A chairman reviewed a synthetic signed application and approved after the bookkeeper validated separate membership fee and initial capital payments without waivers. Event creation, attendance, correction, cancellation, access checks and participation-driven analytics were exercised. Payment duplicate prevention, capital limits, financial reports, rental, POS, protected documents and filtered analytics were also checked. Previous Test Mode authorizations and locally simulated callback replay remain historical evidence; external webhook delivery was not tested.')
doc.add_heading('6 Interaction Capability Findings', 1)
para('P51 checked required and invalid inputs in contact and application forms without persisting invalid submissions. P52 now passes direct entry, navigation, refresh, anonymous denial and a mobile-width check for the canonical share-capital route. P53 checked inquiry processing and success against the isolated API plus simulated error feedback. These checks do not establish subjective usability.')
doc.add_heading('7 Reliability and Repeatability Observations', 1)
para('Member login/logout, prepared membership approval, capital-cap validation and POS checkout were repeated on separate synthetic records with consistent results. This short test cannot establish long-term operational reliability.')
doc.add_heading('8 Defects Limitations and Retests', 1)
table(['ID','Initial finding and cause','Correction and retest'], [('P14','Manual reference rejected a True Member fee with 409 because the creation path enforced an older type restriction despite the stored fee snapshot.','Creation now honors stored fee and initial-capital obligations, locks the application during duplicate checking, and retains separate postings. Signed application, payments and approval passed without waivers.'),('P45','Editable synthetic seed overrode code defaults with different contribution thresholds.','Seed and isolated setting match approved boundaries; existing administrative overrides and historical classifications are not rewritten. All eight validated boundaries and pending exclusion passed.'),('P52','Canonical member share-capital and patronage routes rewrote to themselves, producing a 404.','Proxy now rewrites each canonical route to its actual internal page and the sidebar displays the member role. Direct entry, navigation, refresh, anonymous access, mobile and synthetic balance checks passed. The test-only seed account was backfilled using the existing ledger migration rules.'),('P40','Only activity and attendance source tables existed; management workflow was absent.','Added chairman event management and staff attendance endpoints, audit records, corrections and cancellation, plus a chairman interface. Managed attendance uniqueness preserves legacy records. Workflow and analytics retested.'),('P16','Legacy synthetic seed had one month while new cases used six months.','Synthetic seed and isolated setting updated to six; existing obligations remain unchanged.'),('P27','Duplicate fixture name produced HTTP 500 during the earlier test.','A unique-name retest passed; expected duplicate-name behavior remains an owner-review item.'),('Gateway','Earlier Test Mode and locally signed simulated callback checks passed.','Webhook remains disabled during this assignment. External webhook delivery and current gateway operations were not retested.')])
doc.add_heading('9 Chapter IV Test Case Summary', 1)
table(['Test ID','Test scenario','Expected result','Actual result / status'], [(pid,text,'Behavior stated in scenario, including persisted state where applicable.',outcome(pid)) for i,(pid,text) in enumerate(cases,1)])
doc.add_heading('10 Demonstration Screenshot Inventory', 1)
para('Candidate figures are based on the requested inventory and the inspected route/module list. Captures use the isolated synthetic environment; items marked pending need an appropriate view or workflow. Objective numbers require confirmation against the approved research manuscript. Consolidate similar views when preparing Chapter IV; use detailed screens in the appendix.')
rows=[]
captured = {3:'P08-public-application.png',4:'P04-invalid-login.png',6:'chairman-financial-analytics.png',9:'bookkeeper-financial-ledger.png',12:'bookkeeper-payment-validation.png',15:'chairman-membership-applications.png',16:'chairman-membership-applications.png',22:'chairman-member-analytics.png',24:'chairman-member-analytics.png',25:'chairman-member-analytics.png',26:'chairman-member-analytics.png',27:'chairman-member-analytics.png',28:'chairman-member-analytics.png',31:'chairman-rentals.png',32:'bookkeeper-products.png',36:'bookkeeper-documents.png',41:'chairman-announcements.png',44:'P01-chairman-dashboard.png',45:'bookkeeper-financial-dashboard.png',46:'database-member-capture/screenshots/member-dashboard.png'}
for i,title in enumerate(inventory,1):
    group = 'Public / authentication' if i<=5 else 'Finance' if i<=14 else 'Membership / analytics' if i<=28 else 'Rental / sales' if i<=35 else 'Documents / events / announcements' if i<=43 else 'Additional evidence'
    status = 'Pending Manual Capture; route or functionality needs verification'
    if i==4: status='Captured: P51-login-validation.png (validation state; synthetic)'
    if i==48: status='Captured: P51-login-validation.png'
    if i in captured: status='Captured: '+captured[i]+'; inspect whether the exact requested detail is visible.'
    if i in (20,47): status='Captured: database-resolution-member-verified/screenshots/P52-share-capital.png; corrected canonical route.'
    if i==39: status='Captured: database-resolution-final/screenshots/P40-events.png.'
    if i==40: status='Captured: database-resolution-final/screenshots/P40-attendance.png.'
    rows.append((f'S{i:02d}',title,group,status))
table(['ID','Candidate figure','Module / intended use','Capture status'], rows)
doc.add_heading('11 Captured System Screenshots', 1)
for filename,caption in [('P01-chairman-dashboard.png','Figure 1. Chairman member analytics dashboard.'),('P03-member-dashboard.png','Figure 2. Member dashboard.'),('P04-invalid-login.png','Figure 3. Invalid sign-in feedback.'),('chairman-membership-applications.png','Figure 4. Chairman members workspace.'),('bookkeeper-financial-ledger.png','Figure 5. Financial ledger.'),('bookkeeper-payment-validation.png','Figure 6. Payment validation workspace.'),('bookkeeper-documents.png','Figure 7. Document workspace.'),('chairman-rentals.png','Figure 8. Rental booking workspace.'),('P52-share-capital.png','Figure 9. Corrected member share capital page.'),('P40-events.png','Figure 10. Event management.'),('P40-attendance.png','Figure 11. Attendance recording.')]:
    run = 'database-resolution-member-verified' if filename.startswith('P52-share') else 'database-resolution-final' if filename.startswith('P40-') else 'database-p01-figure' if filename == 'P01-chairman-dashboard.png' else 'database-p03-retest' if filename == 'P03-member-dashboard.png' else 'database-complete'
    path=root/'evidence'/'playwright'/run/'screenshots'/filename
    if path.exists():
        from PIL import Image
        width,height=Image.open(path).size
        doc.add_picture(str(path), width=Inches(min(5.8,5.0*width/height)))
        doc.paragraphs[-1].paragraph_format.keep_with_next = True
        caption_paragraph = doc.add_paragraph(caption, style='Caption')
        caption_paragraph.paragraph_format.keep_with_next = True
        para('Genuine frontend rendering against the isolated synthetic database. Visual capture alone does not establish workflow correctness.')
doc.add_heading('12 Appendix Ready Detailed Test Cases', 1)
para('Each record identifies its disposition and links to execution evidence. The executable tests contain the controlled data, route, role, steps and assertions for the observed checks.')
for i,(pid,text) in enumerate(cases,1):
    doc.add_heading(pid+' '+module(i), 2)
    para('Scenario and expected outcome: '+text)
    para('Preconditions and data: isolated environment and synthetic data appropriate to the scenario. Procedure: exercise the relevant interface or backend boundary and verify persisted state where applicable. Actual and status: '+outcome(pid)+' Exact fixtures, routes and assertions are in the tests/e2e/evidence-*.spec.ts files.')
doc.add_heading('13 Outstanding Work', 1)
para('Review the remaining duplicate-category response and confirm research objective mappings before academic use. P34 covered order payment and pickup release; no pickup-date feature was identified. External PayMongo webhook delivery and current Test Mode transactions were intentionally not tested during corrective work. Performance testing is a separate activity and was not performed here.')
out = root/'TrackCOOP_Playwright_Testing_and_Screenshot_Evidence.docx'
doc.save(out)
check=Document(out)
assert len(check.tables)>=5 and len(cases)==54 and len(inventory)==50
print(f'Saved {out}; tables={len(check.tables)}; inline_images={len(check.inline_shapes)}; cases={len(cases)}; inventory={len(inventory)}')
