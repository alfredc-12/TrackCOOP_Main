# PayMongo system actor setup

TrackCOOP uses **Option B — a configured noninteractive service account** for automated PayMongo settlement.
The existing finance, receipt, validation-history, and audit tables require a non-null user ID, so webhook work cannot safely use a null actor.

## Required account

Create one dedicated user with all of these exact properties:

- `display_name`: `PayMongo System Service`
- `username`: `paymongo-system`
- role: active `bookkeeper`
- `account_status`: `Active`
- no personal staff identity or shared staff credentials

Set `PAYMONGO_SYSTEM_ACTOR_USER_ID` to that user's numeric `user_id` whenever `PAYMONGO_ENABLED=true`.
Do not point the setting at a Chairman, Bookkeeper, Member, or other human account.

The API validates the configured ID, account status, role status, role slug, display name, and username before any webhook settlement. There is no fallback to the first active staff account.

## Portal access

The configured service account is blocked by the normal login service even when a matching password is supplied. It exists only to satisfy database attribution and foreign-key requirements for automated settlement.

## Attribution

Automated records use:

- validation source: `PayMongo Webhook`
- actor: the configured `PayMongo System Service` user
- gateway event ID: the processed PayMongo event
- audit description: explicitly identifies automated webhook settlement

Manual validation continues to use the authenticated active Bookkeeper and cannot use the service account.
