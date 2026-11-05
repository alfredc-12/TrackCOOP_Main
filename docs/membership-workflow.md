# Membership workflow

Public applicants submit without portal accounts and receive an application code plus a private tracking token. The token is required for public status and PayMongo checkout actions.

Supported test payments are the Associate Membership Fee and eligible Share Capital installments. Validated pre-approval capital remains linked to the application. Chairman approval safely backfills/link capital to the Member profile and does not duplicate finance or receipt effects.

Approval alone does not silently promote membership type based on a PayMongo payment. Official membership changes remain in the authorized membership workflow.

After approval, an authenticated Member can contribute to their own Share Capital through `/members/me` routes. The PHP 3,000 target and PHP 15,000 maximum are enforced using validated plus active pending capital. A Member cannot pay for another Member.

Existing Associate Members see their membership badge and an **Apply for True Membership** button on the dashboard. The form shows the existing PHP 3,000 validated contribution requirement and permits an application while contributions are still incomplete. Only one pending application per member is allowed, enforced by both a member-row lock and a database unique key.

The Chairman reviews these applications in **Members → True Membership Applications**, entering an approval or rejection reason. Approval checks the existing member promotion capital rules, then updates the member classification, membership history, application decision and audit record in one transaction. Rejected associates can apply again. The portal refreshes membership details every 15 seconds and on focus.

**Member & Share** and **Financial** are exclusive to True Members. Associate dashboard responses omit their financial summaries and cooperative financial transparency, and restricted share, dividend, patronage and statement endpoints return HTTP 403. Associates retain their other portal services and a limited **Contribute Share Capital** checkout to complete their membership contributions; this does not promote them automatically.

Apply the additive database migration with `npm run db:migrate:membership-upgrades`. It creates only the upgrade request table and preserves existing data. For a fresh schema installation, run this migration after loading the main database schema.

In development, `npm run user:create-associate-test` creates a separate approved, active Associate account and prints its generated credentials. It refuses to overwrite an existing account. The MySQL workflow test can be enabled with `RUN_MEMBERSHIP_UPGRADE_MYSQL_TESTS=true`; it uses session-local temporary tables and does not edit real members or financial records.

## New applications and capital completion

The v2 policy and release prerequisites are documented in [Membership implementation](membership-implementation/README.md). Existing obligations remain preserved; new applications require the one-time PHP 200 fee for both requested membership types.
