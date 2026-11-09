import { expect, test } from "@playwright/test";
import type { BookingDraft, RentalService } from "../../src/app/rental/_types/rental";

const service: RentalService = {
  serviceId: "TRACTOR-TEST", name: "Farm Tractor", category: "Land Preparation",
  shortDescription: "Farm work", description: "Tractor for farm work", imageUrls: [],
  availability: "Available", operationalStatus: "Ready for Use", visibility: "Public",
  unitOfUsage: "Per hectare", suitableActivity: "Plowing", capacity: "5 hectares per day",
  serviceArea: "Nasugbu", operatorRequirement: "Cooperative operator required",
  operationalNotes: "", safetyReminders: [], upcomingBookings: 0, standardRate: 500, updatedAt: "2026-11-09T00:00:00Z",
};

for (const width of [1440,390]) {
  test(`member dashboard shows rental payments and submits a linked member booking at ${width}px`, async ({page}) => {
    await page.setViewportSize({width,height:900});
    await page.setExtraHTTPHeaders({"x-trackcoop-internal-rewrite":"1"});
    const envelope = (data:unknown) => ({success:true,data});
    const date = new Date(); date.setDate(date.getDate()+14);
    const workDate = date.toISOString().slice(0,10);
    let submitted:BookingDraft|undefined;
    await page.route("https://raw.githubusercontent.com/**",r=>r.fulfill({json:{RECORDS:[]}}));
    await page.route("**/api/**",async route=>{
      const path = new URL(route.request().url()).pathname;
      if (path === "/api/auth/me") return route.fulfill({json:envelope({id:"7",displayName:"Juan Santos",email:"member@example.test",role:"member"})});
      if (path === "/api/members/me/dashboard") return route.fulfill({json:{
        isLinked:true,membershipType:"True Member",canAccessFinancials:true,
        member:{code:"TEST-7",occupation:"Farmer",livelihoods:[],memberSince:"2026-01-01"},
        shareCapital:{total:3000},stats:{rentals:1},
        recentActivity:[{type:"Rental Payment",amount:2500,status:"Validated",date:"2026-11-09"}],
        recentCapitalContributions:[],memberFinancialSummary:{incomeByCategory:[],expenseByCategory:[],transactions:[]},
      }});
      if (path === "/api/members/me/membership-progress") return route.fulfill({json:envelope({membershipType:"True Member",sectors:[],capital:null,validatedCapital:3000})});
      if (path === "/api/members/me/membership-payments") return route.fulfill({json:envelope({items:[{reference:"RNT-PAID",purpose:"Rental",amount:2500,status:"Validated",submittedAt:"2026-11-09"}],total:1})});
      if (path === "/api/rental/services") return route.fulfill({json:[service]});
      if (path.endsWith("/booked-dates")) return route.fulfill({json:[]});
      if (path === "/api/rental/requests/member") {
        const raw = /name="draft"\r\n\r\n([^\r]+)/.exec(route.request().postDataBuffer()!.toString());
        submitted = JSON.parse(raw![1]);
        return route.fulfill({json:{inquiryId:"RNT-NEW",requester:{fullName:"Juan Santos",requesterType:"Member"},preferredDate:workDate,preferredEndDate:workDate,status:"New Inquiry",submittedAt:new Date().toISOString()}});
      }
      if (path === "/api/rental/inquiries/public") throw new Error("Member booking must use authenticated member endpoint");
      return route.fulfill({json:envelope([])});
    });
    await page.addInitScript(({workDate})=>sessionStorage.setItem("trackcoop-rental-inquiry-draft",JSON.stringify({
      firstName:"Juan",lastName:"Santos",fullName:"Juan Santos",requesterType:"Public or Non-member",
      contactNumber:"09171234567",completeAddress:"Wawa, Nasugbu",barangay:"Wawa",municipality:"Nasugbu",
      serviceId:"TRACTOR-TEST",intendedUse:"Plowing",requestDescription:"Plowing",preferredDate:workDate,preferredEndDate:workDate,
      preferredStartTime:"08:00",preferredEndTime:"17:00",validIdType:"Philippine National ID",
    })),{workDate});
    await page.goto("/member_dashboard");
    await expect(page.getByRole("button",{name:/1 Rental Bookings/})).toBeVisible();
    await expect(page.getByRole("region",{name:"Recent activity records"})).toContainText("Rental Payment");
    await page.getByText("Personal payment history",{exact:true}).click();
    const history=page.getByRole("region",{name:"payments history"});
    await expect(history).toContainText("RNT-PAID");
    await expect(history).toContainText("Validated");
    await page.getByRole("button",{name:/1 Rental Bookings/}).click();
    await page.locator("article").getByRole("button",{name:"Book a Rental",exact:true}).click();
    await page.locator('input[type="file"]').setInputFiles({name:"id.png",mimeType:"image/png",buffer:Buffer.from("89504e470d0a1a0a","hex")});
    await page.getByRole("button",{name:"Next",exact:true}).click();
    await page.getByRole("combobox",{name:"Select farm work",exact:true}).click();
    await page.getByRole("option",{name:"Plowing",exact:true}).click();
    await page.getByRole("spinbutton",{name:`Hectares on ${workDate}`}).fill("2");
    await page.getByRole("button",{name:"Next",exact:true}).click();
    await page.getByRole("checkbox").check();
    await page.getByRole("button",{name:"Send Rental Request",exact:true}).click();
    await expect.poll(()=>submitted?.requesterType).toBe("Member");
  });
}
