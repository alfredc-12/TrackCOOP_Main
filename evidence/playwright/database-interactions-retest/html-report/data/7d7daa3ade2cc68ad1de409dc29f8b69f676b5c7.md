# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: evidence-interactions.spec.ts >> P51 required and invalid fields are rejected across public forms
- Location: tests\e2e\evidence-interactions.spec.ts:21:5

# Error details

```
Error: expect(locator).toHaveAttribute(expected) failed

Locator: getByLabel('First name', { exact: true })
Expected: "true"
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toHaveAttribute" with timeout 10000ms
  - waiting for getByLabel('First name', { exact: true })

```

```yaml
- main:
  - link "TrackCOOP logo TrackCOOP Cooperative Management System":
    - /url: /#home
    - img "TrackCOOP logo"
    - text: TrackCOOP Cooperative Management System
  - navigation:
    - link "Home":
      - /url: /#home
    - link "About":
      - /url: /#about
    - link "Our Cooperative":
      - /url: /about/our-cooperative
    - link "Board of Directors":
      - /url: /about/board-of-directors
    - link "Services":
      - /url: /#services
    - link "Become a Member":
      - /url: /membership/apply
    - link "Equipment Rental":
      - /url: /rental
    - link "Cooperative Store":
      - /url: /store
    - link "Announcements":
      - /url: /announcements
    - link "Gallery":
      - /url: /gallery
    - link "Contact":
      - /url: /contact
    - link "Submit Inquiry":
      - /url: /contact
    - link "Track Inquiry":
      - /url: /track
  - 'link "Helpdesk: (043) 000-0000"':
    - /url: tel:+630430000000
  - link "Become a member":
    - /url: /membership/apply
  - link "Portal":
    - /url: /login
  - paragraph: Membership
  - heading "Become a Member" [level=1]
  - paragraph: Complete the application below. Payment opens only after chairman review.
  - link "Check application status":
    - /url: /membership/application-status
  - complementary "Application steps and summary":
    - navigation "Application progress":
      - list:
        - 'listitem "Step 1: Personal"': Personal
        - 'listitem "Step 2: Family"': Family
        - 'listitem "Step 3: Membership"': Membership
        - 'listitem "Step 4: Documents"': Documents
        - 'listitem "Step 5: Review"': Review
    - heading "Application summary" [level=3]
    - paragraph: New applicant
    - term: Membership Path
    - definition: Associate
    - term: Membership Fee
    - definition: PHP 200
    - term: Initial total
    - definition: PHP 200
    - term: Full total
    - definition: PHP 200
    - term: Share Capital
    - definition: Not required for Associate
    - term: Payment
    - definition: Not required yet
    - term: Current step
    - definition: Step 1 of 5
    - term: Documents
    - definition: 0 ready
    - term: Signature
    - definition: Needed
  - heading "About You" [level=2]
  - text: Step 1 of 5
  - paragraph: About You
  - heading "Tell us who is applying." [level=2]
  - paragraph: Use the applicant legal name and reachable contact details. Payment is not requested in this step.
  - heading "Name" [level=3]
  - text: First name
  - textbox "First name First name is required." [invalid]
  - text: First name is required. Middle name (optional)
  - textbox "Middle name (optional)"
  - text: Last name
  - textbox "Last name Last name is required." [invalid]
  - text: Last name is required. Suffix (optional)
  - textbox "Suffix (optional)"
  - heading "Contact information" [level=3]
  - text: Email *
  - textbox "Email * Email is required." [invalid]
  - text: Email is required. Contact number +63
  - textbox "Contact number +63 Contact number is required." [invalid]:
    - /placeholder: "9171234567"
  - text: Contact number is required.
  - heading "Referral" [level=3]
  - text: Referral code (optional)
  - textbox "Referral code (optional)":
    - /placeholder: e.g. REF-NFFAC-2026-000001
  - paragraph: Enter the code shared by the member who invited you. Leave this blank if you were not referred.
  - heading "Personal details" [level=3]
  - text: Civil status
  - combobox "Civil status": Single
  - text: Place of birth
  - combobox "Place of birth"
  - text: Date of birth
  - button "Date of birth": Select birth date
  - text: Date of birth is required.
  - heading "Occupation" [level=3]
  - group "Occupation — select all that apply":
    - text: Occupation — select all that apply
    - paragraph: Choose at least one. You can choose more than one job.
    - checkbox "Farmer"
    - text: Farmer
    - checkbox "Fisherfolk"
    - text: Fisherfolk
    - checkbox "Livestock raiser"
    - text: Livestock raiser
    - checkbox "Poultry raiser"
    - text: Poultry raiser
    - checkbox "Aquaculture worker"
    - text: Aquaculture worker
    - checkbox "Agricultural worker"
    - text: Agricultural worker
    - checkbox "Fish vendor"
    - text: Fish vendor
    - checkbox "Entrepreneur"
    - text: Entrepreneur
    - checkbox "Government employee"
    - text: Government employee
    - checkbox "Private employee"
    - text: Private employee
    - checkbox "Self-employed"
    - text: Self-employed
    - checkbox "Student"
    - text: Student
    - checkbox "Retired"
    - text: Retired
    - checkbox "Unemployed"
    - text: Unemployed Other occupation (optional)
    - textbox "Other occupation (optional)":
      - /placeholder: Enter another occupation
    - alert: Occupation is required.
  - button "Back" [disabled]
  - button "Continue"
  - paragraph: NASUGBU FARMERS AND FISHERFOLKS AGRICULTURE COOPERATIVE
  - paragraph: Agriculture and fisherfolk cooperative landing portal.
  - paragraph: Copyright 2026. All rights reserved.
- region "Notifications alt+T"
- alert
```

# Test source

```ts
  1  | import { expect,test,type Page } from "@playwright/test";
  2  | import mysql,{type RowDataPacket} from "mysql2/promise";
  3  | import { randomUUID } from "node:crypto";
  4  | async function database() {
  5  |   const db=await mysql.createConnection({host:"127.0.0.1",port:33327,user:"root",database:"trackcoop_evidence_synthetic"});
  6  |   const [rows]=await db.query<RowDataPacket[]>("SELECT @@port AS port,@@datadir AS dir,DATABASE() AS db");
  7  |   const dir=String(rows[0].dir).replace(/\\/g,"/").replace(/\/$/,"").toLowerCase();
  8  |   if(Number(rows[0].port)!==33327 || rows[0].db!=="trackcoop_evidence_synthetic" || !dir.endsWith("/trackcoop_main/scratch/playwright-isolated-mysql/data")){await db.end();throw new Error("Refusing unverified database");}
  9  |   return db;
  10 | }
  11 | async function fillInquiry(page:Page,subject:string) {
  12 |   await page.getByLabel("Full Name").fill("Synthetic Visitor");
  13 |   await page.getByLabel("Email Address").fill(`synthetic-${randomUUID().slice(0,8)}@gmail.com`);
  14 |   await page.getByLabel(/Phone Number/).fill("9171112222");
  15 |   await page.getByLabel(/Barangay/).fill("Lumbangan");
  16 |   await page.getByLabel("Subject").fill(subject);
  17 |   await page.getByLabel(/Message/).fill("Synthetic inquiry for Playwright testing.");
  18 | }
  19 | test.beforeAll(async()=>{const db=await database();await db.end();});
  20 | 
  21 | test("P51 required and invalid fields are rejected across public forms",async({page})=>{
  22 |   const db=await database();
  23 |   try {
  24 |     const [before]=await db.query<RowDataPacket[]>("SELECT (SELECT COUNT(*) FROM requests_inquiries) AS inquiries,(SELECT COUNT(*) FROM membership_applications) AS applications");
  25 |     await page.goto("/contact"); await page.getByRole("button",{name:"Submit Inquiry"}).click();
  26 |     await expect(page.getByText("Name is required.")).toBeVisible(); await expect(page.getByText("Email address is required.")).toBeVisible();
  27 |     await page.getByLabel("Email Address").fill("not-an-email"); await page.getByRole("button",{name:"Submit Inquiry"}).click();
  28 |     expect(await page.getByLabel("Email Address").evaluate((input:HTMLInputElement)=>input.validity.typeMismatch)).toBe(true);
  29 |     await page.getByLabel("Email Address").fill("synthetic@example.invalid"); await page.getByRole("button",{name:"Submit Inquiry"}).click();
  30 |     await expect(page.getByText("Please enter a valid @gmail.com address.")).toBeVisible();
  31 |     await page.goto("/membership/apply"); await page.getByRole("button",{name:"Continue",exact:true}).click();
> 32 |     await expect(page.getByLabel("First name",{exact:true})).toHaveAttribute("aria-invalid","true");
     |                                                              ^ Error: expect(locator).toHaveAttribute(expected) failed
  33 |     await expect(page.getByText(/First name is required/i)).toBeVisible();
  34 |     const [after]=await db.query<RowDataPacket[]>("SELECT (SELECT COUNT(*) FROM requests_inquiries) AS inquiries,(SELECT COUNT(*) FROM membership_applications) AS applications");
  35 |     expect(after[0]).toEqual(before[0]);
  36 |   } finally {await db.end();}
  37 | });
  38 | 
  39 | test("P53 inquiry processing, success and simulated error feedback are visible",async({page})=>{
  40 |   const db=await database();
  41 |   try {
  42 |     const subject=`Synthetic feedback ${randomUUID()}`;
  43 |     let release!:()=>void; const gate=new Promise<void>(resolve=>{release=resolve;});
  44 |     await page.route("**/api/requests/public",async route=>{await gate;await route.continue();});
  45 |     await page.goto("/contact"); await fillInquiry(page,subject);
  46 |     await page.getByRole("button",{name:"Submit Inquiry"}).click();
  47 |     await expect(page.getByRole("button",{name:"Submitting..."})).toBeDisabled(); release();
  48 |     const dialog=page.getByRole("dialog",{name:"Inquiry Submitted!"}); await expect(dialog).toBeVisible();
  49 |     await expect(dialog.getByText("Your Tracking Code:")).toBeVisible();
  50 |     const [rows]=await db.execute<RowDataPacket[]>("SELECT subject FROM requests_inquiries WHERE subject=?",[subject]); expect(rows).toHaveLength(1);
  51 |     await dialog.getByRole("button",{name:"Close",exact:true}).click();
  52 |     await page.unroute("**/api/requests/public");
  53 |     await page.route("**/api/requests/public",route=>route.fulfill({status:503,json:{success:false,message:"Synthetic failure"}}));
  54 |     await fillInquiry(page,`Synthetic failure ${randomUUID()}`); await page.getByRole("button",{name:"Submit Inquiry"}).click();
  55 |     await expect(page.getByText("Failed to submit inquiry. Please try again later.")).toBeVisible();
  56 |   } finally {await db.end();}
  57 | });
  58 | 
```