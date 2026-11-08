import { expect,test,type Page } from "@playwright/test";
import mysql,{type RowDataPacket} from "mysql2/promise";
import { randomUUID } from "node:crypto";
async function database() {
  const db=await mysql.createConnection({host:"127.0.0.1",port:33327,user:"root",database:"trackcoop_evidence_synthetic"});
  const [rows]=await db.query<RowDataPacket[]>("SELECT @@port AS port,@@datadir AS dir,DATABASE() AS db");
  const dir=String(rows[0].dir).replace(/\\/g,"/").replace(/\/$/,"").toLowerCase();
  if(Number(rows[0].port)!==33327 || rows[0].db!=="trackcoop_evidence_synthetic" || !dir.endsWith("/trackcoop_main/scratch/playwright-isolated-mysql/data")){await db.end();throw new Error("Refusing unverified database");}
  return db;
}
async function fillInquiry(page:Page,subject:string) {
  await page.getByLabel("Full Name").fill("Synthetic Visitor");
  await page.getByLabel("Email Address").fill(`synthetic-${randomUUID().slice(0,8)}@gmail.com`);
  await page.getByLabel(/Phone Number/).fill("9171112222");
  await page.getByLabel(/Barangay/).fill("Lumbangan");
  await page.getByLabel("Subject").fill(subject);
  await page.getByLabel(/Message/).fill("Synthetic inquiry for Playwright testing.");
}
test.beforeAll(async()=>{const db=await database();await db.end();});

test("P51 required and invalid fields are rejected across public forms",async({page})=>{
  const db=await database();
  try {
    const [before]=await db.query<RowDataPacket[]>("SELECT (SELECT COUNT(*) FROM requests_inquiries) AS inquiries,(SELECT COUNT(*) FROM membership_applications) AS applications");
    await page.goto("/contact"); await page.getByRole("button",{name:"Submit Inquiry"}).click();
    await expect(page.getByText("Name is required.")).toBeVisible(); await expect(page.getByText("Email address is required.")).toBeVisible();
    await page.getByLabel("Email Address").fill("not-an-email"); await page.getByRole("button",{name:"Submit Inquiry"}).click();
    expect(await page.getByLabel("Email Address").evaluate((input:HTMLInputElement)=>input.validity.typeMismatch)).toBe(true);
    await page.getByLabel("Email Address").fill("synthetic@example.invalid"); await page.getByRole("button",{name:"Submit Inquiry"}).click();
    await expect(page.getByText("Please enter a valid @gmail.com address.")).toBeVisible();
    await page.goto("/membership/apply"); await page.getByRole("button",{name:"Continue",exact:true}).click();
    await expect(page.getByRole("textbox",{name:/^First name/})).toHaveAttribute("aria-invalid","true");
    await expect(page.getByText(/First name is required/i)).toBeVisible();
    const [after]=await db.query<RowDataPacket[]>("SELECT (SELECT COUNT(*) FROM requests_inquiries) AS inquiries,(SELECT COUNT(*) FROM membership_applications) AS applications");
    expect(after[0]).toEqual(before[0]);
  } finally {await db.end();}
});

test("P53 inquiry processing, success and simulated error feedback are visible",async({page})=>{
  const db=await database();
  try {
    const subject=`Synthetic feedback ${randomUUID()}`;
    let release!:()=>void; const gate=new Promise<void>(resolve=>{release=resolve;});
    await page.route("**/api/requests/public",async route=>{await gate;await route.continue();});
    await page.goto("/contact"); await fillInquiry(page,subject);
    await page.getByRole("button",{name:"Submit Inquiry"}).click();
    await expect(page.getByRole("button",{name:"Submitting..."})).toBeDisabled(); release();
    const dialog=page.getByRole("dialog",{name:"Inquiry Submitted!"}); await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Your Tracking Code:")).toBeVisible();
    const [rows]=await db.execute<RowDataPacket[]>("SELECT subject FROM requests_inquiries WHERE subject=?",[subject]); expect(rows).toHaveLength(1);
    await dialog.getByRole("button",{name:"Close",exact:true}).click();
    await page.unroute("**/api/requests/public");
    await page.route("**/api/requests/public",route=>route.fulfill({status:503,json:{success:false,message:"Synthetic failure"}}));
    await fillInquiry(page,`Synthetic failure ${randomUUID()}`); await page.getByRole("button",{name:"Submit Inquiry"}).click();
    await expect(page.getByText("Failed to submit inquiry. Please try again later.")).toBeVisible();
  } finally {await db.end();}
});
