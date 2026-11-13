# Membership queue layouts

The Bookkeeper Membership Payments page paginates its two existing datasets
independently. Applicants needing payment start at five rows per page; recorded
payments retain their existing pagination. Search and status changes reset both
pages, page-size controls use the shared StyledSelect, and refreshes clamp an
out-of-range page when the queue shrinks. Summary cards still use the loaded
datasets rather than only the visible page. Existing API fetch limits are unchanged.

The Chairman Members header contains a True Membership Applications button with
the loaded pending count. It opens a right-side Radix dialog drawer, full-width on
phones. The drawer has search, pagination and an independently scrolling body.
Application review stays inside the same drawer, with a back button and fixed
approval/rejection actions. Decision reasons, API calls and server authorization
remain unchanged. Escape or Close returns focus to the header button; navigation
within the drawer moves focus to the relevant review heading or search field.

Implementation: `MembershipPaymentsView.tsx`, `MembershipUpgradeReviews.tsx`, and
`chairman/members/MembersClient.tsx`. Browser verification uses synthetic fixtures
in `tests/e2e/membership-queue-layout.spec.ts` and the existing upgrade workflow
test in `tests/e2e/member-membership-access.spec.ts`. It covers desktop/tablet/phone,
independent pages, filtering, refresh shrinkage, queue search, approval, rejection,
empty/error states and focus return. No real payments or membership decisions are
performed by these tests.
