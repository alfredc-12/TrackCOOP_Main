# Authentication and Roles

## Active Roles

TrackCOOP recognizes exactly three role slugs: `chairman`, `bookkeeper`, and
`member`. Chairman holds the cooperative administration authority. There is no
Admin, Manager, Staff, or Viewer application role.

Backend endpoints use `createAuthenticate` to resolve the current database
session and `requireRoles(...)` to enforce authorization. The Next.js proxy only
checks whether a cookie is present for an early redirect; it is not a security
boundary and never replaces backend session or role validation.

## RBAC Matrix

| Area | Chairman | Bookkeeper | Member |
| --- | --- | --- | --- |
| Users, roles, member approvals, status history | Manage | No access | Own public/member-facing data only |
| Member indicators | Manage/recalculate | No access | No access |
| Payment references | Read oversight | Create/update/validate/reject | Own submissions where exposed |
| Share capital | Read oversight | Create/update and review progress | Own progress where exposed |
| Financial ledger/categories | Read oversight | Manage/post/void | No access |
| POS, inventory, rentals | Oversight/admin | Operations and payment validation | Own browsing, checkout, and requests |
| Documents/reports | Staff access | Staff access | Allowed documents only |
| Announcements | Manage/publish/archive | Read authenticated | Read targeted/public |
| Requests/notifications | Staff review/status | Staff review/status | Own requests/notifications |
| Landing content/settings/audit logs | Manage | No access | Public landing only |

## Session Security

Login accepts an email address or username and a password. Passwords are checked
with bcrypt. Successful login creates a cryptographically random opaque token,
stores only its SHA-256 hash in `user_sessions`, and sends the raw token in an
HttpOnly, SameSite=Lax cookie. Production cookies are also Secure.

After five failed password attempts, the account is locked for 15 minutes by
default. These values and session lifetime can be configured in the ignored
`server/.env` file. Login, failed login, logout, session revocation, and bootstrap
account creation produce audit records without passwords or raw tokens.

## Account Provisioning

Public registration is disabled. Create the first Chairman and Bookkeeper
accounts only from an interactive terminal:

```bash
npm run user:create -- --email chair@example.com --name "Chair Person" --role chairman
npm run user:create -- --email books@example.com --name "Book Keeper" --role bookkeeper
```

The command never accepts a password argument, disables terminal echo while the
password is entered, asks for confirmation, hashes the value with bcrypt, and
refuses duplicate emails. The 34-table schema and reference roles must exist
first.

## Deferred Reset Flow

Forgot-password delivery and reset-password endpoints are intentionally deferred.
No reset token is returned, printed, logged, or exposed through a placeholder
endpoint.
