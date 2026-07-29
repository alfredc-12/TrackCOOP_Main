# Membership workflow

Public applicants submit without portal accounts and receive an application code plus a private tracking token. The token is required for public status and PayMongo checkout actions.

Supported test payments are the Associate Membership Fee and eligible Share Capital installments. Validated pre-approval capital remains linked to the application. Chairman approval safely backfills/link capital to the Member profile and does not duplicate finance or receipt effects.

Approval alone does not silently promote membership type based on a PayMongo payment. Official membership changes remain in the authorized membership workflow.

After approval, an authenticated Member can contribute to their own Share Capital through `/members/me` routes. The PHP 3,000 target and PHP 15,000 maximum are enforced using validated plus active pending capital. A Member cannot pay for another Member.
