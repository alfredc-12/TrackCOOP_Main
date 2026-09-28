import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const membersClientSource = () =>
  readFileSync(
    path.join(process.cwd(), "src/app/(portal)/chairman/members/MembersClient.tsx"),
    "utf8",
  );
const repositorySource = () =>
  readFileSync(
    path.join(process.cwd(), "server/src/modules/membership-applications/membership-application.repository.ts"),
    "utf8",
  );
const controllerSource = () =>
  readFileSync(
    path.join(process.cwd(), "server/src/modules/membership-applications/membership-application.controller.ts"),
    "utf8",
  );
const realtimeRoutesSource = () =>
  readFileSync(
    path.join(process.cwd(), "server/src/modules/realtime/realtime.routes.ts"),
    "utf8",
  );
const realtimeEventsSource = () =>
  readFileSync(
    path.join(process.cwd(), "server/src/modules/realtime/realtime.events.ts"),
    "utf8",
  );
const clientRealtimeSource = () =>
  readFileSync(
    path.join(process.cwd(), "src/lib/realtime.ts"),
    "utf8",
  );
const portalShellSource = () =>
  readFileSync(
    path.join(process.cwd(), "src/components/portal/PortalShell.tsx"),
    "utf8",
  );
const paymongoSettlementSource = () =>
  readFileSync(
    path.join(process.cwd(), "server/src/modules/paymongo/paymongo.settlement.ts"),
    "utf8",
  );

test("chairman review sidebar uses Signed Application requirement status instead of file existence", () => {
  const source = membersClientSource();

  assert.match(source, /signedApplicationStatus/);
  assert.match(source, /label="Signed Application" status=\{signedApplicationStatus\}/);
  assert.doesNotMatch(
    source,
    /label="Signed Application" done=\{detail\.documents\.some/,
  );
});

test("chairman review separates pre-payment requirements from payment requirements", () => {
  const source = membersClientSource();

  assert.match(source, /prePaymentRequirementProgress/);
  assert.match(source, /paymentRequirementTypes/);
  assert.match(source, /"Associate Membership Fee"/);
  assert.match(source, /"Initial Share Capital"/);
});

test("requirement decisions are locked until chairman starts review", () => {
  const uiSource = membersClientSource();
  const backendSource = repositorySource();

  assert.match(uiSource, /reviewStarted/);
  assert.match(uiSource, /Start the application review before verifying/);
  assert.match(backendSource, /MEMBERSHIP_REVIEW_NOT_STARTED/);
  assert.match(backendSource, /existing\.applicationStatus !== "Under Review"/);
});

test("chairman can add applicant document requests before requesting information", () => {
  const uiSource = membersClientSource();
  const backendSource = repositorySource();

  assert.match(uiSource, /RequestRequirementPanel/);
  assert.equal((uiSource.match(/renderRequestRequirementPanel\(\)/g) ?? []).length, 1);
  assert.match(uiSource, /addApplicationRequirement/);
  assert.match(uiSource, /isPublicFollowUpRequirement/);
  assert.match(uiSource, /availableRequestRequirementTypes/);
  assert.match(uiSource, /All document types requested/);
  assert.match(uiSource, /RequirementDocumentUploadButton/);
  assert.match(uiSource, /requirementStatus: "Submitted"/);
  assert.match(uiSource, /documentRequirementForReview/);
  assert.match(uiSource, /verifyDocument/);
  assert.match(uiSource, /requirementTypeForDocument/);
  assert.doesNotMatch(uiSource, /No requested documents/);
  assert.match(uiSource, /followUpRequirements\.length > 0/);
  assert.match(uiSource, /Add or reject an applicant document requirement before requesting more information/);
  assert.match(backendSource, /if \(duplicateRows\[0\]\)/);
  assert.match(backendSource, /MEMBERSHIP_REQUIREMENT_DUPLICATE/);
  assert.match(backendSource, /OR r\.remarks IS NOT NULL/);
});

test("chairman membership application workspace receives real-time refresh events", () => {
  const uiSource = membersClientSource();
  const portalShell = portalShellSource();
  const backendController = controllerSource();
  const realtimeRoutes = realtimeRoutesSource();
  const realtimeEvents = realtimeEventsSource();
  const clientRealtime = clientRealtimeSource();
  const paymongoSettlement = paymongoSettlementSource();

  assert.match(realtimeRoutes, /\/events/);
  assert.match(realtimeEvents, /text\/event-stream/);
  assert.match(clientRealtime, /new EventSource/);
  assert.match(clientRealtime, /withCredentials: true/);
  assert.match(portalShell, /useRealtimeEvents/);
  assert.match(portalShell, /router\.refresh\(\)/);
  assert.match(backendController, /publishMembershipApplicationEvent/);
  assert.match(backendController, /membership-application\.document-uploaded/);
  assert.match(paymongoSettlement, /membership-application\.payment-settled/);
  assert.match(uiSource, /useRealtimeEvents/);
  assert.match(uiSource, /event\.channel !== "membership-applications"/);
  assert.match(uiSource, /void loadApplications\(\)/);
});
