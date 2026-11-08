# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: evidence-interactions.spec.ts >> P51 required and invalid fields are rejected across public forms
- Location: tests\e2e\evidence-interactions.spec.ts:21:5

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('Please enter a valid @gmail.com address.')
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for getByText('Please enter a valid @gmail.com address.')

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
  - heading "Contact Us" [level=1]
  - paragraph: For member assistance, cooperative services, farm and fishery coordination, or public inquiries, use the contact channels below.
  - link "Track an inquiry":
    - /url: /track
  - region "Contact the cooperative":
    - heading "Submit an Inquiry" [level=2]
    - paragraph: Have a question? Send us a direct message and our admin team will review it.
    - text: Full Name *
    - textbox "Full Name":
      - /placeholder: Juan Dela Cruz
    - paragraph: Name is required.
    - text: Email Address *
    - textbox "Email Address":
      - /placeholder: juan@gmail.com
      - text: not-an-email
    - text: Phone Number * +63
    - textbox "Phone Number * +63":
      - /placeholder: "9000000000"
    - paragraph: Phone number is required.
    - text: Barangay * Brgy.
    - textbox "Barangay * Brgy.":
      - /placeholder: "1"
    - paragraph: Barangay is required.
    - text: Priority
    - 'combobox "Priority: Normal"'
    - paragraph: Choose Urgent only when immediate attention is needed.
    - text: Category *
    - 'combobox "Category: General"'
    - text: Subject *
    - textbox "Subject":
      - /placeholder: What is this regarding?
    - paragraph: Subject is required.
    - text: Message *
    - textbox "Message *":
      - /placeholder: Type your inquiry here...
    - paragraph: Message is required.
    - button "Submit Inquiry"
    - heading "Cooperative Office" [level=2]
    - paragraph: Nasugbu Farmers and Fisherfolks Agriculture Cooperative
    - paragraph: Map Coordinates
    - paragraph: 14.058886759350967, 120.63832068540415
    - link "Office Number (043) 000-0000":
      - /url: tel:+630430000000
      - paragraph: Office Number
      - paragraph: (043) 000-0000
    - link "Mobile Number +63 900 000 0000":
      - /url: tel:+639000000000
      - paragraph: Mobile Number
      - paragraph: +63 900 000 0000
    - link "Email nasugbu.agri.coop@example.com":
      - /url: mailto:nasugbu.agri.coop@example.com
      - paragraph: Email
      - paragraph: nasugbu.agri.coop@example.com
    - paragraph: Office Hours
    - paragraph: Monday to Friday, 8:00 AM - 5:00 PM
    - region "Office location":
      - iframe
      - link "Open in Google Maps":
        - /url: https://maps.google.com/?q=14.058886759350967,120.63832068540415
  - heading "Online channels." [level=2]
  - paragraph: Placeholder links for now. These can be replaced with official cooperative accounts when ready.
  - link "Facebook Page facebook.com/trackcoop":
    - /url: "#"
  - link "Messenger m.me/trackcoop":
    - /url: "#"
  - link "Website trackcoop.local":
    - /url: "#"
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
> 28 |     await expect(page.getByText("Please enter a valid @gmail.com address.")).toBeVisible();
     |                                                                              ^ Error: expect(locator).toBeVisible() failed
  29 |     await page.goto("/membership/apply"); await page.getByRole("button",{name:"Continue",exact:true}).click();
  30 |     await expect(page.getByLabel("First name",{exact:true})).toHaveAttribute("aria-invalid","true");
  31 |     await expect(page.getByText(/First name is required/i)).toBeVisible();
  32 |     const [after]=await db.query<RowDataPacket[]>("SELECT (SELECT COUNT(*) FROM requests_inquiries) AS inquiries,(SELECT COUNT(*) FROM membership_applications) AS applications");
  33 |     expect(after[0]).toEqual(before[0]);
  34 |   } finally {await db.end();}
  35 | });
  36 | 
  37 | test("P53 inquiry processing, success and simulated error feedback are visible",async({page})=>{
  38 |   const db=await database();
  39 |   try {
  40 |     const subject=`Synthetic feedback ${randomUUID()}`;
  41 |     let release!:()=>void; const gate=new Promise<void>(resolve=>{release=resolve;});
  42 |     await page.route("**/api/requests/public",async route=>{await gate;await route.continue();});
  43 |     await page.goto("/contact"); await fillInquiry(page,subject);
  44 |     await page.getByRole("button",{name:"Submit Inquiry"}).click();
  45 |     await expect(page.getByRole("button",{name:"Submitting..."})).toBeDisabled(); release();
  46 |     const dialog=page.getByRole("dialog",{name:"Inquiry Submitted!"}); await expect(dialog).toBeVisible();
  47 |     await expect(dialog.getByText("Your Tracking Code:")).toBeVisible();
  48 |     const [rows]=await db.execute<RowDataPacket[]>("SELECT subject FROM requests_inquiries WHERE subject=?",[subject]); expect(rows).toHaveLength(1);
  49 |     await dialog.getByRole("button",{name:"Close",exact:true}).click();
  50 |     await page.unroute("**/api/requests/public");
  51 |     await page.route("**/api/requests/public",route=>route.fulfill({status:503,json:{success:false,message:"Synthetic failure"}}));
  52 |     await fillInquiry(page,`Synthetic failure ${randomUUID()}`); await page.getByRole("button",{name:"Submit Inquiry"}).click();
  53 |     await expect(page.getByText("Failed to submit inquiry. Please try again later.")).toBeVisible();
  54 |   } finally {await db.end();}
  55 | });
  56 | 
```