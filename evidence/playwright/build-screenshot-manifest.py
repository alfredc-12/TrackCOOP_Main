from pathlib import Path
from datetime import datetime
import json, re

root=Path(__file__).resolve().parents[2]
out=root/'evidence/playwright/final-screenshots'
source=Path(r'C:\Users\Alfred\.codex\attachments\69f4a9c8-c412-4bcc-826e-0d1e2b19f06e\Pasted text.txt').read_text(encoding='utf-8')
section=source.split('### A. Public and authentication interfaces',1)[1].split('This is a **candidate screenshot inventory**',1)[0]
subjects=re.findall(r'^\d+\.\s+(.+)$',section,re.M)
assert len(subjects)==50

# Each entry describes exactly what is visible, including partial or absent views.
links={
1:('public-authentication/homepage-viewport.png','ready','Public landing page and navigation.'),
2:('public-authentication/cooperative-information.png','ready','Cooperative information and membership overview.'),
3:('public-authentication/application-viewport.png','ready','Prospective member application fields.'),
4:('public-authentication/login.png','ready','Clean sign-in screen.'),
5:('chairman-membership/member-directory-view.png','ready','Chairman navigation and member directory.'),
6:('financial-management/financial-overview-viewport.png','ready','Financial analytics, filters, and export button.'),
7:('financial-management/financial-overview-viewport.png','ready','Income, expense, and indicative net surplus.'),
8:('financial-management/financial-analytics.png','ready','Full financial analytics including trends.'),
9:('financial-management/financial-ledger.png','ready','Bookkeeper financial ledger.'),
10:(None,'unavailable','A usable add or edit transaction form was not captured.'),
11:('financial-management/financial-categories.png','ready','Managed financial categories.'),
12:('financial-management/payment-review.png','ready','Synthetic payment reference review dialog.'),
13:('financial-management/financial-overview-viewport.png','ready','Reporting filters on the financial dashboard.'),
14:('financial-management/financial-overview-viewport.png','partial','Export Excel action is visible; workbook contents are not shown.'),
15:('chairman-membership/applications-viewport.png','ready','Membership application list and statuses.'),
16:('chairman-membership/application-review.png','ready','Synthetic application detail and review progress.'),
17:('member-bookkeeper-portals/member-profile.png','ready','Synthetic member profile settings.'),
18:('chairman-membership/member-directory-view.png','ready','Associate and True Member counts.'),
19:('share-capital/member-share-capital.png','ready','Member capital balance and transaction history.'),
20:('chairman-membership/application-review.png','ready','Synthetic application capital progress.'),
21:(None,'unavailable','PayMongo is disabled; no external checkout or webhook was triggered.'),
22:('member-analytics/analytics-overview.png','partial','Loaded dashboard filters and top of capital-completion chart; detailed metrics shown in related images.'),
23:('member-analytics/rfm-summary.png','ready','RFM-inspired member indicator workspace.'),
24:('member-analytics/analytics-geography.png','partial','Barangay map is shown with boundaries; external map tiles were blocked and part of the map extends below the viewport.'),
25:('member-analytics/membership-growth.png','ready','Agricultural sector chart and member engagement.'),
26:('member-analytics/membership-growth.png','ready','Membership growth chart.'),
27:('member-analytics/referral-summary.png','ready','Recruitment performance chart.'),
28:('member-analytics/referral-summary.png','ready','Referral counts and qualification summary.'),
29:('rental-management/rental-services-viewport.png','partial','Rental equipment listings are loaded, but synthetic equipment photos are unavailable.'),
30:('rental-management/rental-bookings-viewport.png','ready','Rental request and scheduling list.'),
31:('rental-management/booking-details.png','ready','Synthetic booking details and status.'),
32:('pos-sales/inventory-viewport.png','ready','Product and inventory management.'),
33:('pos-sales/sale-details-viewport.png','partial','Completed synthetic order details shown; checkout itself was not captured.'),
34:('pos-sales/member-orders.png','partial','Completed member orders and synthetic pickup release notes; no dated pickup scheduling view identified.'),
35:('pos-sales/pos-sales.png','ready','Sales list and status summary.'),
36:('document-management/document-repository.png','ready','Document repository and access levels.'),
37:('document-management/document-upload.png','ready','Upload form and audience/access-level control.'),
38:('document-management/document-details.png','partial','Authorized document metadata shown; content preview was not captured.'),
39:('events-attendance/event-edit.png','ready','Event editing form and scheduled-event list.'),
40:('events-attendance/attendance-list-viewport.png','ready','Recorded synthetic attendance and correction control.'),
41:('announcements-notifications/announcements.png','ready','Chairman announcement management.'),
42:('member-bookkeeper-portals/member-notifications.png','ready','Member-facing announcements.'),
43:('member-bookkeeper-portals/member-notifications.png','ready','Member-facing live alerts.'),
44:('member-analytics/analytics-overview.png','ready','Chairman dashboard and navigation.'),
45:('member-bookkeeper-portals/bookkeeper-dashboard-viewport.png','ready','Bookkeeper dashboard and navigation.'),
46:('member-bookkeeper-portals/member-dashboard-viewport.png','ready','Member dashboard.'),
47:('share-capital/member-capital-viewport.png','ready','Corrected member capital page and synthetic balance.'),
48:('public-authentication/login-validation.png','ready','Previously captured required-field validation.'),
49:('document-management/document-details.png','partial','Bookkeeper-only access label and metadata; actual content not shown.'),
50:('financial-management/financial-overview-viewport.png','partial','Authorized Excel export control visible; no exported workbook preview.'),
}
logs=[]
for name in ('capture-log.json','detail-capture-log.json','views-capture-log.json','analytics-capture-log.json'):
 p=out/name
 if p.exists():logs.extend(json.loads(p.read_text(encoding='utf-8')))
by_file={Path(x['file']).resolve():x for x in logs if x.get('file')}
for file,role,route in [('chairman-membership/applications-viewport.png','chairman','/portal/chairman/members'),('pos-sales/inventory-viewport.png','bookkeeper','/portal/bookkeeper/products-inventory'),('member-bookkeeper-portals/bookkeeper-dashboard-viewport.png','bookkeeper','/portal/bookkeeper/financial-dashboard'),('member-bookkeeper-portals/member-dashboard-viewport.png','member','/portal/member/dashboard'),('rental-management/rental-services-viewport.png','public','/rental'),('rental-management/rental-bookings-viewport.png','chairman','/portal/chairman/rentals/bookings')]:
 by_file[(out/file).resolve()]={'role':role,'route':route}
figures=[
('public-authentication/homepage-viewport.png','Public homepage'),('public-authentication/login.png','Sign-in interface'),('public-authentication/application-viewport.png','Membership application'),('public-authentication/login-validation.png','Sign-in validation'),
('chairman-membership/applications-viewport.png','Membership applications'),('chairman-membership/application-review.png','Application review and capital progress'),('chairman-membership/member-directory-view.png','Member directory and classification'),
('share-capital/member-capital-viewport.png','Member share-capital overview'),('financial-management/financial-overview-viewport.png','Financial analytics and filters'),('financial-management/financial-ledger.png','Financial ledger'),('financial-management/financial-categories.png','Financial categories'),('financial-management/payment-review.png','Payment reference review'),
('member-analytics/membership-growth.png','Membership growth, engagement and capital health'),('member-analytics/rfm-summary.png','Member indicators'),('member-analytics/referral-summary.png','Recruitment and referrals'),
('rental-management/rental-bookings-viewport.png','Rental requests and schedules'),('rental-management/booking-details.png','Rental booking details'),('pos-sales/pos-sales.png','Product sales'),('pos-sales/sale-details-viewport.png','Sale details'),
('document-management/document-repository.png','Document repository'),('document-management/document-upload.png','Document upload and access'),('events-attendance/event-edit.png','Event scheduling and editing'),('events-attendance/attendance-list-viewport.png','Event attendance and corrections'),('member-bookkeeper-portals/member-notifications.png','Member announcements and alerts'),('member-bookkeeper-portals/member-dashboard-viewport.png','Member dashboard')]
figure_files={x for x,_ in figures}
rows=[]
for i,subject in enumerate(subjects,1):
 file,status,description=links[i]; meta=by_file.get((out/file).resolve(),{}) if file else {}
 if file and not (out/file).is_file():raise FileNotFoundError(file)
 rows.append({'id':f'S{i:02}','subject':subject,'file':file,'module':file.split('/')[0] if file else None,'role':('public' if i==48 else meta.get('role')),'route':meta.get('route') or ('/login' if i==48 else None),'capture_date':datetime.fromtimestamp((out/file).stat().st_mtime).astimezone().isoformat(timespec='seconds') if file else None,'description':description,'intended_use':'Chapter IV' if file in figure_files else 'Appendix or supporting evidence','verification':status})
allfiles=sorted(p for p in out.glob('*/*.png'))
images=[]
for p in allfiles:
 rel=p.relative_to(out).as_posix();meta=by_file.get(p.resolve(),{}); mapped=[r['id'] for r in rows if r['file']==rel]
 images.append({'file':rel,'module':rel.split('/')[0],'role':('public' if rel.endswith('login-validation.png') else meta.get('role')),'route':meta.get('route') or ('/login' if rel.endswith('login-validation.png') else None),'capture_date':datetime.fromtimestamp(p.stat().st_mtime).astimezone().isoformat(timespec='seconds'),'description':next((r['description'] for r in rows if r['file']==rel),p.stem.replace('-',' ').capitalize()),'inventory_ids':mapped,'intended_use':'Chapter IV' if rel in figure_files else 'Appendix or supporting evidence','verification':'ready' if any(r['file']==rel and r['verification']=='ready' for r in rows) else 'partial' if mapped else 'supplementary - visually reviewed','origin':'reused' if rel.endswith('login-validation.png') else 'new'})
payload={'capture_date':'2026-11-08 Asia/Manila','inventory':rows,'images':images,'figures':[{'file':f,'caption':c} for f,c in figures]}
(out/'manifest.json').write_text(json.dumps(payload,indent=2,ensure_ascii=False),encoding='utf8')
lines=['# TrackCOOP screenshot manifest','',f'{len(rows)} inventory subjects reviewed; {len(images)} unique images; 1 reused and {len(images)-1} newly captured.','', 'The images show synthetic data. PayMongo was disabled. `partial` means the image demonstrates only the specified part; `unavailable` means no suitable image was obtained.','', '| ID | Subject | File | Role | Route | Capture date | Intended use | Verification and scope |','|---|---|---|---|---|---|---|---|']
for r in rows:lines.append('| '+ ' | '.join(str(r[k] or '—').replace('|','/') for k in ['id','subject','file','role','route','capture_date','intended_use'])+' | '+r['verification']+': '+r['description']+' |')
lines+=['','## All images','', '| File | Module | Role | Route | Capture date | Inventory | Use | Verification |','|---|---|---|---|---|---|---|---|']
for r in images:lines.append('| '+' | '.join([r['file'],r['module'],str(r['role'] or 'unknown'),str(r['route'] or 'unknown'),r['capture_date'],', '.join(r['inventory_ids']) or 'supplementary',r['intended_use'],r['verification']])+' |')
(out/'README.md').write_text('\n'.join(lines)+'\n',encoding='utf8')
print(json.dumps({'subjects':len(rows),'images':len(images),'reused':1,'new':len(images)-1,'figures':len(figures),'unavailable':[r['id'] for r in rows if r['verification']=='unavailable'],'partial':[r['id'] for r in rows if r['verification']=='partial']}))
