# Membership Workflow

## Public Applicant Flow

Applicants use `/membership/apply` to submit a membership application without a
portal account. The API stores the application, beneficiaries, initial
requirements, optional protected document metadata, status history, and audit
records in one transaction. The response shows the application code and private
tracking token once.

Applicants use `/membership/application-status` with the application code and
tracking token. The server stores only the SHA-256 tracking-token hash and
returns safe public status fields; internal notes, protected file paths, account
data, and audit details are not exposed.

## Chairman Review Flow

Chairmen review applications from the Members area. The workflow supports:

- Application inbox, detail view, filters, and summary counts.
- Paper-form encoding through the same Chairman-only API family.
- Beneficiary maintenance.
- Protected document upload/removal.
- Requirement checklist verification and waiver reasons.
- Status timeline for submitted, review, information-requested, rejected,
  withdrawn, and approved states.
- Printable protected application output.

Approval requires the configured orientation, associate fee, and initial
share-capital rules. Conversion creates or links the member profile, records
status history and audit logs, and may optionally issue a pending member portal
account with a one-time activation URL.

## Member And User Lifecycle

Public applicants do not receive portal accounts before approval. Chairmen can
create user accounts, issue activation links, change roles, activate/suspend/
deactivate/reactivate users, revoke sessions, and link or unlink approved member
profiles where the business rules allow it. The last Chairman and self-role
removal protections remain enforced.

## Member Indicators

Member indicators are decision-support signals. Recalculation uses real records
where available, including payment references, share capital, POS sales, rental
activity, and document activity. Indicator status and basis explanations do not
change the official member status on `member_profiles`.
