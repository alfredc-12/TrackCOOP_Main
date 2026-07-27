# Graph Report - TrackCOOP_Main  (2026-07-27)

## Corpus Check
- 513 files · ~594,791 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 3330 nodes · 7570 edges · 194 communities (137 shown, 57 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 45 edges (avg confidence: 0.72)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `182756f8`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- useRentalData
- finance.repository.ts
- people-api.ts
- membership.repository.ts
- member.repository.ts
- MembersClient.tsx
- landing.controller.ts
- communication.types.ts
- share-capital.repository.ts
- TrackCOOP_MAIN_Database.sql
- communication.repository.ts
- rental.ts
- components/MembershipApplicationForm.tsx
- api-client.ts
- requireApiUser
- payment-reference.repository.ts
- auth.service.ts
- membership-application-api.ts
- AuthContext
- TrackCOOP_Table_Reference_Only.sql
- errorHandler
- membership-application.repository.ts
- FinanceViews.tsx
- member-indicator.repository.ts
- useRental
- SiteHeader.tsx
- (LandingPage)/page.tsx
- auth.types.ts
- membership-application.controller.ts
- members/service.ts
- formatRentalDate
- import-facebook-announcements.ts
- LandingAdminViews.tsx
- compilerOptions
- membership-application.service.ts
- next-api-auth.ts
- auth-client.ts
- asyncHandler
- RentalInquiryReview.tsx
- rentalDatabase.ts
- createMembershipApplicationController
- MembershipApplicationRepository
- MembershipPaymentsView.tsx
- MemberIndicatorsClient.tsx
- ChairmanRentalBookingDetails.tsx
- UserRepository
- PortalShell.tsx
- RentalMemberArea.tsx
- RentalPayments.tsx
- getPool
- membership-application.routes.test.ts
- scripts
- membership-application.types.ts
- ChairmanRentalAssetsClient.tsx
- RentalInquiryForm.tsx
- compilerOptions
- PortalRoutePage.tsx
- member_dashboard/page.tsx
- user.repository.ts
- MembershipPublicShell.tsx
- MembersClient
- @playwright/test
- stringValue
- PortalPrimitives.tsx
- devDependencies
- src/app.ts
- transaction.ts
- ChairmanPosInventoryClient.tsx
- user.controller.ts
- member.controller.ts
- user.service.test.ts
- [...path]/route.ts
- ChairmanRentalCalendar.tsx
- ChairmanRentalBookingsClient.tsx
- user.service.ts
- usePublishedLandingContent.ts
- RentalServiceForm.tsx
- MemberPosClient.tsx
- createMemberIndicatorController
- payment-reference.controller.ts
- ChairmanRentalAssetEditor.tsx
- RentalScheduleForm.tsx
- proxy.ts
- schema-check.ts
- rentalValidation.ts
- isoDateTime
- member.routes.test.ts
- execute
- dependencies
- inventoryQueries.ts
- PosSalesClient.tsx
- persistedScheduleConflict
- database.ts
- member-indicator.controller.ts
- 20260724_add_membership_application_workflow.sql
- 20260724_membership_applications.sql
- MemberForm.tsx
- RequestRecord
- MembershipApplicationBeneficiaryInput
- confirm/route.ts
- ProductCatalogClient.tsx
- StatsParallaxSection.tsx
- chairman-user-accounts.spec.ts
- dev.mjs
- app/layout.tsx
- chairman-member-directory.spec.ts
- chairman-member-indicators.spec.ts
- chairman-membership-applications.spec.ts
- package.json
- 20260723_rental_operations.sql
- ReportRecord
- payments/actions.ts
- NotificationRecord
- express.d.ts
- rental/settings/page.tsx
- AppError
- chart.js
- class-variance-authority
- clsx
- cookie-parser
- cors
- date-fns
- dotenv
- eslint.config.mjs
- graphify reference: transcribe video and audio
- express
- express-rate-limit
- framer-motion
- helmet
- @hookform/resolvers
- lucide-react
- motion
- mysql2
- next
- next.config.ts
- pdfkit
- @radix-ui/react-dialog
- @radix-ui/react-dropdown-menu
- @radix-ui/react-select
- clsx
- cookie-parser
- react-dom
- sonner
- cors
- zod
- zustand
- dotenv
- eslint-config-next
- helmet
- motion
- mysql2
- @radix-ui/react-dialog
- @radix-ui/react-dropdown-menu
- @radix-ui/react-progress
- postcss.config.mjs
- prettier.config.js
- 20260725_split_membership_application_applicant_name.sql
- config/app.ts
- lib/logger.ts
- global.ts
- @radix-ui/react-tabs
- react-chartjs-2
- tailwind-merge
- supertest
- tailwindcss
- @tailwindcss/postcss
- tsx
- @types/cookie-parser
- @types/cors
- @types/multer
- @types/supertest

## God Nodes (most connected - your core abstractions)
1. `AuthContext` - 185 edges
2. `apiRequest()` - 77 edges
3. `requireApiUser()` - 62 edges
4. `AppError` - 49 edges
5. `CommunicationRepository` - 45 edges
6. `getPool()` - 41 edges
7. `users` - 40 edges
8. `useRentalData()` - 38 edges
9. `createCommunicationController()` - 34 edges
10. `formatRentalDate()` - 34 edges

## Surprising Connections (you probably didn't know these)
- `RentalInquiryForm()` --indirect_call--> `file()`  [INFERRED]
  src/app/rental/_components/RentalInquiryForm.tsx → scripts/verify-records-modules.ts
- `UploadRow()` --indirect_call--> `file()`  [INFERRED]
  src/features/membership-applications/components/MembershipApplicationForm.tsx → scripts/verify-records-modules.ts
- `ChairmanPosInventoryClient()` --indirect_call--> `file()`  [INFERRED]
  src/features/pos/components/ChairmanPosInventoryClient.tsx → scripts/verify-records-modules.ts
- `createCommunicationController()` --indirect_call--> `request()`  [INFERRED]
  server/src/modules/communication/communication.controller.ts → src/app/rental/_lib/rentalApi.ts
- `createMemberIndicatorController()` --indirect_call--> `indicator()`  [INFERRED]
  server/src/modules/member-indicators/member-indicator.controller.ts → tests/e2e/chairman-member-indicators.spec.ts

## Import Cycles
- None detected.

## Communities (194 total, 57 thin omitted)

### Community 0 - "useRentalData"
Cohesion: 0.12
Nodes (19): columns, RentalAccessGate(), blank, tabs, columns, RentalPageHeader(), emptyPayment, RentalPaymentStatusBadge() (+11 more)

### Community 1 - "finance.repository.ts"
Cohesion: 0.05
Nodes (41): createFinanceController(), parseBody(), requireAuth(), requireParam(), validationError(), voidRecordSchema, CategoryRow, CountRow (+33 more)

### Community 2 - "people-api.ts"
Cohesion: 0.05
Nodes (75): MemberAccountLinkDialog(), accountStatuses, ActionKind, actionStatus(), actionTitle(), ActivationResultDialog(), AuditLogDialog(), blankForm (+67 more)

### Community 3 - "membership.repository.ts"
Cohesion: 0.07
Nodes (22): ApplicationRow, CountRow, createMembershipRepository(), IdRow, PaymentRow, validApplication, createMembershipService(), AccountCreationInput (+14 more)

### Community 4 - "member.repository.ts"
Cohesion: 0.09
Nodes (23): CountRow, HistoryRow, LatestIndicatorRow, MemberRow, PaymentActivityRow, PosActivityRow, RentalActivityRow, ShareCapitalRow (+15 more)

### Community 5 - "MembersClient.tsx"
Cohesion: 0.05
Nodes (47): ApplicationDetailDialog(), ApplicationFormDialog(), ApplicationFormState, applicationFullName(), ApplicationsResponsiveList(), blankApplication, blankMemberForm, ConfirmAction (+39 more)

### Community 6 - "landing.controller.ts"
Cohesion: 0.07
Nodes (40): createLandingController(), createSchemas, parse(), requireAuth(), requireCollection(), requireParam(), sendList(), updateSchemas (+32 more)

### Community 7 - "communication.types.ts"
Cohesion: 0.06
Nodes (51): parse(), requestContext(), requireAuth(), requireParam(), validationError(), archiveReportSchema, baseRequestSchema, createAnnouncementSchema (+43 more)

### Community 8 - "share-capital.repository.ts"
Cohesion: 0.09
Nodes (21): createShareCapitalController(), CountRow, createShareCapitalRepository(), ProgressRow, ShareCapitalRepository, ShareRow, sortColumns, SummaryRow (+13 more)

### Community 9 - "TrackCOOP_MAIN_Database.sql"
Cohesion: 0.12
Nodes (47): `announcement_acknowledgments`, announcement_recipients, announcements, audit_logs, document_access_logs, documents, financial_categories, financial_records (+39 more)

### Community 10 - "communication.repository.ts"
Cohesion: 0.05
Nodes (32): AnnouncementRow, announcementSortColumns, CountRow, CreateAnnouncementInput, createCommunicationRepository(), CreateDocumentInput, CreateReportInput, CreateRequestInput (+24 more)

### Community 11 - "rental.ts"
Cohesion: 0.06
Nodes (38): blank, ChairmanRentalAssetEditor(), RentalContextValue, RentalApiError, checkRentalScheduleConflict(), scheduleTime(), existing, service (+30 more)

### Community 12 - "components/MembershipApplicationForm.tsx"
Cohesion: 0.06
Nodes (32): ApplicationProgress(), steps, ApplicationSuccess(), ApplicationSuccessProps, BeneficiaryFields(), BeneficiaryFieldsProps, CommitmentReview(), CommitmentReviewProps (+24 more)

### Community 13 - "api-client.ts"
Cohesion: 0.07
Nodes (35): file(), activateMembershipAccount(), createMembershipAccount(), getMembershipApplication(), lookupMembershipApplication(), MembershipApplication, MembershipDraft, MembershipPayment (+27 more)

### Community 14 - "requireApiUser"
Cohesion: 0.06
Nodes (42): GET(), GET(), GET(), DELETE(), InventoryProductUpdateInput, PUT(), InventoryBalanceRow, POST() (+34 more)

### Community 15 - "payment-reference.repository.ts"
Cohesion: 0.12
Nodes (18): createPaymentReferenceController(), CountRow, createPaymentReferenceRepository(), PaymentReferenceRepository, PaymentRow, sortColumns, createPaymentReferenceService(), PaymentReferenceService (+10 more)

### Community 16 - "auth.service.ts"
Cohesion: 0.15
Nodes (30): createApp(), CreateAppOptions, createCorsOptions(), createAuthenticate(), requireRoles(), notFound(), requestId(), requestLogger() (+22 more)

### Community 17 - "membership-application-api.ts"
Cohesion: 0.07
Nodes (36): ApplicationStatusLookup(), StatusFormValues, statusSchema, ApiFailure, ApiSuccess, getMembershipApplicationStatus(), ApprovalInput, ApprovalResult (+28 more)

### Community 18 - "AuthContext"
Cohesion: 0.10
Nodes (12): AuthContext, createCommunicationController(), CommunicationRepository, CommunicationService, AnnouncementRecord, DocumentRecord, NotificationRecord, ReportRecord (+4 more)

### Community 19 - "TrackCOOP_Table_Reference_Only.sql"
Cohesion: 0.11
Nodes (40): announcement_recipients, announcements, audit_logs, document_access_logs, documents, financial_categories, financial_records, gallery_items (+32 more)

### Community 20 - "errorHandler"
Cohesion: 0.08
Nodes (29): createRoleApp(), errorHandler(), createErrorApp(), auth, user, AuthUser, RoleSlug, baseUser (+21 more)

### Community 21 - "membership-application.repository.ts"
Cohesion: 0.06
Nodes (28): allowedTransitions, applicationSelect(), BeneficiaryRow, ChairmanApplicationRow, CountRow, dateMonthsFromNow(), defaultSettings, DocumentRow (+20 more)

### Community 22 - "FinanceViews.tsx"
Cohesion: 0.09
Nodes (22): CurrencyDisplay(), FinancialCategory, FinancialRecord, FinancialSummary, getFinancialSummary(), getShareCapitalSummary(), listFinancialCategories(), listFinancialRecords() (+14 more)

### Community 23 - "member-indicator.repository.ts"
Cohesion: 0.06
Nodes (39): limitOffsetSql(), normalizeSqlInteger(), createMemberIndicatorController(), parseBody(), requireParam(), validationError(), ActivityMetricRow, addUtcMonths() (+31 more)

### Community 24 - "useRental"
Cohesion: 0.10
Nodes (25): RentalBreadcrumbs(), RentalHeader(), roles, items, RentalMobileNavigation(), RentalModuleShell(), links, RentalPublicHeader() (+17 more)

### Community 25 - "SiteHeader.tsx"
Cohesion: 0.10
Nodes (9): boardMembers, metadata, classifications, metadata, metadata, metadata, SiteFooter(), sectionIds (+1 more)

### Community 26 - "(LandingPage)/page.tsx"
Cohesion: 0.06
Nodes (13): certifications, CertificationSlide, fadeUp, heroFloatingSeeds, heroSeedlings, heroSlides, photos, Project (+5 more)

### Community 27 - "auth.types.ts"
Cohesion: 0.08
Nodes (16): AuthRepository, createAuthRepository(), CreateSessionInput, FailedLoginInput, LoginAccountRow, SessionRow, SessionSummaryRow, activeAccount (+8 more)

### Community 28 - "membership-application.controller.ts"
Cohesion: 0.10
Nodes (24): authContext(), documentFile(), MulterFile, parse(), publicContext(), trackingToken(), UploadRequest, validationError() (+16 more)

### Community 29 - "members/service.ts"
Cohesion: 0.11
Nodes (20): GET(), GET(), GET(), Column, DataTable(), DataTableProps, MemberTable(), getMemberById() (+12 more)

### Community 30 - "formatRentalDate"
Cohesion: 0.10
Nodes (11): RentalInquiryReview(), RentalInquiryStepper(), steps, RentalInquiryMobileCard(), RentalPolicyNotice(), ScheduleList(), RentalServiceBrowser(), RentalServiceDetails() (+3 more)

### Community 31 - "import-facebook-announcements.ts"
Cohesion: 0.12
Nodes (25): DATA_FILE, decodeHtml(), downloadImage(), generateTitle(), getImageUrls(), getMeta(), IMAGE_DIR, imageExtension() (+17 more)

### Community 32 - "LandingAdminViews.tsx"
Cohesion: 0.11
Nodes (12): createLandingRecord(), LandingCollection, LandingRecord, listAuditLogs(), listLandingRecords(), listSystemSettings(), saveSystemSetting(), updateLandingRecord() (+4 more)

### Community 33 - "compilerOptions"
Cohesion: 0.07
Nodes (28): dom, dom.iterable, esnext, **/*.mts, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, **/*.ts (+20 more)

### Community 34 - "membership-application.service.ts"
Cohesion: 0.09
Nodes (18): createMembershipApplicationRepository(), addPdfLine(), allowedDocuments, buildPrintablePdf(), hashToken(), isAllowedMembershipDocumentExtension(), isAllowedMembershipDocumentMimeType(), normalizeChairmanApplication() (+10 more)

### Community 35 - "next-api-auth.ts"
Cohesion: 0.11
Nodes (44): userFor(), UserRow, verify(), bookkeeperCategories, canAccessDocument(), canManageDocument(), canUploadDocument(), DocumentPolicyActor (+36 more)

### Community 36 - "auth-client.ts"
Cohesion: 0.18
Nodes (10): LoginPage(), roleDestinations, destinations, LoginFormValues, loginSchema, AuthUser, LoginInput, getOptionalAuthenticatedUser() (+2 more)

### Community 37 - "asyncHandler"
Cohesion: 0.09
Nodes (28): SAFE_METHODS, validateOrigin(), cookieOptions(), createAuthController(), requestContext(), validationError(), loginSchema, sessionIdSchema (+20 more)

### Community 38 - "RentalInquiryReview.tsx"
Cohesion: 0.04
Nodes (39): Core Routes, POS, Inventory, and Rentals, Staff Route Families, TrackCOOP API Notes, Account Provisioning, Active Roles, Authentication and Roles, Deferred Reset Flow (+31 more)

### Community 39 - "rentalDatabase.ts"
Cohesion: 0.05
Nodes (71): fileRules, InquiryFormValues, inquirySchema, optionalText, rentalRescheduleSchema, rentalScheduleSchema, rentalServiceSchema, requiredConsent (+63 more)

### Community 40 - "createMembershipApplicationController"
Cohesion: 0.18
Nodes (5): createMembershipApplicationController(), MembershipApplicationService, ChairmanApplicationDetail, ChairmanApplicationRequirement, StatusTransitionInput

### Community 41 - "MembershipApplicationRepository"
Cohesion: 0.08
Nodes (23): FakeMembershipApplicationRepository, ApprovalInput, ApprovalResult, ChairmanApplicationListItem, ChairmanMembershipApplicationInput, CivilStatus, civilStatuses, documentTypes (+15 more)

### Community 42 - "MembershipPaymentsView.tsx"
Cohesion: 0.08
Nodes (24): For /graphify add and --watch, For /graphify query, For the commit hook and native CLAUDE.md integration, For --update and --cluster-only, /graphify, Honesty Rules, Interpreter guard for subcommands, Part A - Structural extraction for code files (+16 more)

### Community 43 - "MemberIndicatorsClient.tsx"
Cohesion: 0.10
Nodes (23): emptySummary, formatCurrency(), formatDate(), IndicatorDetailDialog(), indicatorTone(), MemberIndicatorsClient(), parseBasisSummary(), scoreLabel() (+15 more)

### Community 44 - "ChairmanRentalBookingDetails.tsx"
Cohesion: 0.10
Nodes (33): cell(), GET(), GET(), PATCH(), PatchBody, POST(), formString(), GET() (+25 more)

### Community 45 - "UserRepository"
Cohesion: 0.18
Nodes (3): createUserController(), UserService, UserListQuery

### Community 46 - "PortalShell.tsx"
Cohesion: 0.16
Nodes (14): Breadcrumbs(), titleize(), findPortalNavItem(), getPortalRoleFromPath(), PortalNavGroup, portalNavigation, PortalNavItem, roleHomePaths (+6 more)

### Community 47 - "RentalMemberArea.tsx"
Cohesion: 0.11
Nodes (37): filterKeys, GET(), POST(), REPORT_CATALOG, ReportFilters, addDateRange(), addEquals(), archiveGeneratedReport() (+29 more)

### Community 48 - "RentalPayments.tsx"
Cohesion: 0.05
Nodes (24): EquipmentAvailabilityBoard(), RentalAnalyticsView(), RentalUtilizationView(), RentalAudit(), RentalExpenseForm(), RentalExpensesList(), RentalInquiryTable(), RentalMemberHome() (+16 more)

### Community 49 - "getPool"
Cohesion: 0.21
Nodes (15): run(), getDatabaseConfig(), createPoolOptions(), getPool(), probeDatabase(), main(), addColumns(), addIndex() (+7 more)

### Community 50 - "membership-application.routes.test.ts"
Cohesion: 0.12
Nodes (5): detail(), FakeChairmanService, ChairmanApplicationListQuery, ChairmanApplicationListResult, MembershipApplicationStatus

### Community 51 - "scripts"
Cohesion: 0.09
Nodes (23): scripts, build, build:api, build:web, db:check, db:migrate:records, db:migrate:rental, db:seed (+15 more)

### Community 52 - "membership-application.types.ts"
Cohesion: 0.12
Nodes (13): applicationFullName(), chairmanUser, createAuthService(), createChairmanApp(), CreatedApplication, createTestApp(), defaultSettings, protectedUploadRoot (+5 more)

### Community 53 - "ChairmanRentalAssetsClient.tsx"
Cohesion: 0.13
Nodes (12): AssetMobileCard(), AssetRow(), AssetStatusFilter, ChairmanRentalAssetsClient(), displayDate(), displayDateRange(), matchesStatusFilter(), PendingAction (+4 more)

### Community 54 - "RentalInquiryForm.tsx"
Cohesion: 0.08
Nodes (20): addMonths(), AvailabilityCalendar(), dateKeysBetween(), defaultValues, Field(), firstBlockedDateInRange(), flattenErrors(), localDateKey() (+12 more)

### Community 55 - "compilerOptions"
Cohesion: 0.10
Nodes (20): dist, node, src/**/*.d.ts, src/**/*.test.ts, src/**/*.ts, compilerOptions, esModuleInterop, forceConsistentCasingInFileNames (+12 more)

### Community 56 - "PortalRoutePage.tsx"
Cohesion: 0.07
Nodes (35): FormDialog(), ActivityList(), DocumentDetailPage(), sourceHref(), statusTone(), DocumentMetadataFields(), DocumentsPage(), emptyFilters (+27 more)

### Community 57 - "member_dashboard/page.tsx"
Cohesion: 0.12
Nodes (12): ActivityItem, HelpCenter(), Ticket, ProfileSettings(), ChairmanAnnouncementsClient(), Button(), ButtonProps, buttonVariants (+4 more)

### Community 58 - "user.repository.ts"
Cohesion: 0.06
Nodes (32): CountRow, createUserRepository(), LinkableMemberRow, RoleRow, SessionRow, SettingRow, sortColumns, SummaryRow (+24 more)

### Community 59 - "MembershipPublicShell.tsx"
Cohesion: 0.17
Nodes (5): MembershipActivationForm(), MembershipFollowUpForm(), MembershipPublicShell(), LastSubmission, MembershipSuccess()

### Community 60 - "MembersClient"
Cohesion: 0.09
Nodes (22): API Client And Fetching, Auth, RBAC, Sessions, And Proxy, Backend Modules, Baseline Checks, Current Implementation Status, Current State Audit, Database And Reference SQL, Frontend People Screens (+14 more)

### Community 61 - "@playwright/test"
Cohesion: 0.15
Nodes (7): RentalChartCard(), loader(), RentalDashboard(), RentalMetricCard(), iconForCategory(), RentalServiceCard(), RentalErrorState()

### Community 62 - "stringValue"
Cohesion: 0.13
Nodes (16): ChairmanRentalBookingDetails(), displayDate(), displayDateRange(), ReviewDraft, ScheduleDraft, tone(), BookingActions(), assertRentalStatusTransition() (+8 more)

### Community 63 - "PortalPrimitives.tsx"
Cohesion: 0.29
Nodes (6): PortalSidebar(), PortalSidebarProps, SidebarContent(), Input(), InputProps, cn()

### Community 64 - "devDependencies"
Cohesion: 0.12
Nodes (17): eslint, devDependencies, eslint, @playwright/test, @types/express, @types/node, @types/pdfkit, @types/react (+9 more)

### Community 65 - "src/app.ts"
Cohesion: 0.17
Nodes (5): createMembershipController(), MembershipRepository, MembershipService, MembershipApplicationInput, UploadedApplicationDocument

### Community 66 - "transaction.ts"
Cohesion: 0.18
Nodes (12): withTransaction(), ExistingUserRow, provisionAccount(), ProvisionAccountInput, RoleRow, argumentsSchema, main(), parseArguments() (+4 more)

### Community 67 - "ChairmanPosInventoryClient.tsx"
Cohesion: 0.13
Nodes (11): CategoryComboboxProps, ChairmanPosInventoryClient(), EditableInventoryItem, formatQuantityUnit(), InventoryItem, PosOrder, PosOrderItem, STOCK_UNIT_OPTIONS (+3 more)

### Community 68 - "user.controller.ts"
Cohesion: 0.19
Nodes (17): parseBody(), requireParam(), validationError(), accountStatuses, bulkUserActionSchema, createUserSchema, deleteUserSchema, issueActivationLinkSchema (+9 more)

### Community 69 - "member.controller.ts"
Cohesion: 0.19
Nodes (12): parseBody(), requireParam(), approvalStatuses, listMembersQuerySchema, listUnifiedStatusHistoryQuerySchema, memberProfileSchema, membershipTypes, officialMemberStatuses (+4 more)

### Community 70 - "user.service.test.ts"
Cohesion: 0.20
Nodes (7): RentalInquirySuccess(), RentalStatusBadge(), BARANGAYS, EXPENSE_CATEGORIES, paymentStatusTone, rentalStatusTone, PaymentStatus

### Community 71 - "[...path]/route.ts"
Cohesion: 0.15
Nodes (23): normalizeProtectedStoragePath(), protectedUploadRoot, authorize(), authorizeActor(), badRequest(), body(), GET(), json() (+15 more)

### Community 72 - "ChairmanRentalCalendar.tsx"
Cohesion: 0.25
Nodes (11): CalendarView, ChairmanRentalCalendar(), formatDate(), formatDateRange(), localDateKey(), monthDays(), MonthGrid(), parseDate() (+3 more)

### Community 73 - "ChairmanRentalBookingsClient.tsx"
Cohesion: 0.08
Nodes (22): AssetDetailsData, ChairmanRentalAssetDetails(), formatDate(), formatDateRange(), PageHeader(), PageHeaderProps, ConfirmDialog(), DataTable() (+14 more)

### Community 74 - "user.service.ts"
Cohesion: 0.11
Nodes (13): MembersClient(), getMemberDetail(), getMemberSummary(), listMembers(), listMembersPaginated(), listUnifiedStatusHistory(), deleteApplicationBeneficiary(), deleteApplicationDocument() (+5 more)

### Community 75 - "usePublishedLandingContent.ts"
Cohesion: 0.23
Nodes (12): Home(), GalleryGrid(), photos, asString(), emptyPayload, mapPublishedCertifications(), mapPublishedProjects(), mapPublishedServices() (+4 more)

### Community 77 - "MemberPosClient.tsx"
Cohesion: 0.16
Nodes (9): StorePublicHeader(), CartItem, formatQuantityUnit(), InventoryItem, MemberPosClient(), MemberPosClientProps, PosOrder, PosOrderItem (+1 more)

### Community 78 - "createMemberIndicatorController"
Cohesion: 0.14
Nodes (13): Baseline, Chairman and Bookkeeper Portals Implementation Plan, Current Repository Audit, Database Table to Module Mapping, Implementation Sequence and Commit Boundaries, Migration Constraints, Mock and Placeholder Implementations, Permission Matrix (+5 more)

### Community 79 - "payment-reference.controller.ts"
Cohesion: 0.20
Nodes (13): parse(), parseJson(), requireParam(), sendProtectedFile(), uploadedDocuments(), accountCreationSchema, activationSchema, additionalInformationSchema (+5 more)

### Community 80 - "ChairmanRentalAssetEditor.tsx"
Cohesion: 0.15
Nodes (12): Ask the graph a question, Check automatic hooks, Explain one node, Graphify, Initial build, Open full graph, Refresh after pulling repository changes, Refresh after uncommitted changes (+4 more)

### Community 81 - "RentalScheduleForm.tsx"
Cohesion: 0.24
Nodes (6): RentalConflictModal(), blank, RentalScheduleForm(), scheduleCandidate(), schedulePayload(), scheduleWithInquiry()

### Community 82 - "proxy.ts"
Cohesion: 0.23
Nodes (12): AuthPayload, canonicalPath(), config, getSessionRole(), internalPath(), isRole(), landingPaths, loginRedirect() (+4 more)

### Community 83 - "schema-check.ts"
Cohesion: 0.21
Nodes (11): app, expectedDatabaseTables, closePool(), checkDatabaseSchema(), compareDatabaseTables(), DatabaseTableRow, SchemaComparison, server (+3 more)

### Community 84 - "rentalValidation.ts"
Cohesion: 0.13
Nodes (14): Role, roles, AuditActivity, DocumentActivity, DocumentDetail, DocumentListResponse, DocumentRecord, DocumentSummary (+6 more)

### Community 85 - "isoDateTime"
Cohesion: 0.21
Nodes (11): BookingMobileCard(), BookingRow(), BookingView, bookingViews, ChairmanRentalBookingsClient(), formatDate(), formatDateRange(), matchesBookingView() (+3 more)

### Community 86 - "member.routes.test.ts"
Cohesion: 0.24
Nodes (6): createMemberService(), ApprovalStatus, MemberProfile, MemberProfileInput, UpdateMemberProfileInput, UpdateMemberStatusInput

### Community 87 - "execute"
Cohesion: 0.22
Nodes (10): parseBody(), requireAuth(), requireParam(), validationError(), listPaymentReferencesQuerySchema, paymentPurposes, paymentReferenceSchema, reviewPaymentReferenceSchema (+2 more)

### Community 88 - "dependencies"
Cohesion: 0.22
Nodes (9): date-fns, multer, dependencies, date-fns, multer, react, react-hook-form, react (+1 more)

### Community 89 - "inventoryQueries.ts"
Cohesion: 0.31
Nodes (7): GET(), InventoryMovementRow, InventoryProduct, InventoryProductRow, listInventoryProducts(), ListInventoryProductsOptions, mapProductStatus()

### Community 90 - "PosSalesClient.tsx"
Cohesion: 0.25
Nodes (4): formatMoney(), PosOrder, PosOrderItem, PosSalesClient()

### Community 91 - "persistedScheduleConflict"
Cohesion: 0.23
Nodes (5): exportHref(), HistoryActions(), ReportHistoryPage(), report(), GeneratedReportRecord

### Community 92 - "database.ts"
Cohesion: 0.21
Nodes (9): DatabaseConfig, databaseEnvSchema, parseDatabaseConfig(), booleanString, envSchema, parsedEnv, ServerEnvironment, getServerEnvPath() (+1 more)

### Community 93 - "member-indicator.controller.ts"
Cohesion: 0.38
Nodes (3): createMemberController(), MemberRepository, MemberService

### Community 94 - "20260724_add_membership_application_workflow.sql"
Cohesion: 0.52
Nodes (6): membership_application_beneficiaries, membership_application_documents, membership_application_requirements, membership_application_status_history, membership_applications, user_activation_tokens

### Community 95 - "20260724_membership_applications.sql"
Cohesion: 0.48
Nodes (6): membership_account_activations, membership_application_documents, membership_application_notes, membership_application_payments, membership_application_status_history, membership_applications

### Community 97 - "RequestRecord"
Cohesion: 0.23
Nodes (8): destinations, PortalAuthGuard(), requiredRole(), bookkeeperNavItems, chairmanNavItems, memberNavItems, Sidebar(), logout()

### Community 98 - "MembershipApplicationBeneficiaryInput"
Cohesion: 0.13
Nodes (6): MembershipApplicationRepository, ChairmanApplicationBeneficiary, ChairmanApplicationHistoryEntry, ChairmanApplicationSummary, MembershipApplicationBeneficiaryInput, RequirementInput

### Community 99 - "confirm/route.ts"
Cohesion: 0.22
Nodes (11): CentralDocumentInput, createCentralDocument(), createGeneratedPdfDocument(), GeneratedPdfDocumentInput, renderPdf(), safeBaseName(), FinancialCategoryRow, InventoryBalanceRow (+3 more)

### Community 100 - "ProductCatalogClient.tsx"
Cohesion: 0.40
Nodes (3): formatQuantityUnit(), InventoryItem, ProductCatalogClient()

### Community 102 - "chairman-user-accounts.spec.ts"
Cohesion: 0.60
Nodes (5): apiPort, envelope(), mockApiResponse(), userDetail(), userSummary()

### Community 104 - "app/layout.tsx"
Cohesion: 0.40
Nodes (3): geistMono, geistSans, metadata

### Community 105 - "chairman-member-directory.spec.ts"
Cohesion: 0.60
Nodes (4): apiPort, envelope(), member(), mockApiResponse()

### Community 106 - "chairman-member-indicators.spec.ts"
Cohesion: 0.60
Nodes (4): document_access_logs, document_versions, documents, reports

### Community 107 - "chairman-membership-applications.spec.ts"
Cohesion: 0.60
Nodes (4): apiPort, detail(), envelope(), mockApiResponse()

### Community 108 - "package.json"
Cohesion: 0.50
Nodes (3): name, private, version

### Community 109 - "20260723_rental_operations.sql"
Cohesion: 0.50
Nodes (3): rental_booking_sequences, rental_idempotency_keys, rental_maintenance_periods

### Community 110 - "ReportRecord"
Cohesion: 0.22
Nodes (8): graphify reference: extra exports and benchmark, Step 6b - Wiki (only if --wiki flag), Step 7 - Neo4j export (only if --neo4j or --neo4j-push flag), Step 7a - FalkorDB export (only if --falkordb or --falkordb-push flag), Step 7b - SVG export (only if --svg flag), Step 7c - GraphML export (only if --graphml flag), Step 7d - MCP server (only if --mcp flag), Step 8 - Token reduction benchmark (only if total_words > 5000)

### Community 112 - "NotificationRecord"
Cohesion: 0.25
Nodes (4): auth, member, memberDetail, MemberDetail

### Community 113 - "express.d.ts"
Cohesion: 0.39
Nodes (5): ForceChangePasswordPage(), PortalRedirectPage(), MemberDashboardPage(), getAuthenticatedUser(), getCurrentUser()

### Community 114 - "rental/settings/page.tsx"
Cohesion: 0.33
Nodes (5): For /graphify explain, For /graphify path, graphify reference: query, path, explain, Step 0 — Constrained query expansion (REQUIRED before traversal), Step 1 — Traversal

### Community 116 - "chart.js"
Cohesion: 0.33
Nodes (3): contactCards, metadata, socialLinks

### Community 117 - "class-variance-authority"
Cohesion: 0.50
Nodes (3): For /graphify add, For --watch, graphify reference: add a URL and watch a folder

### Community 118 - "clsx"
Cohesion: 0.50
Nodes (3): For git commit hook, For native CLAUDE.md integration, graphify reference: commit hook and native CLAUDE.md integration

### Community 119 - "cookie-parser"
Cohesion: 0.50
Nodes (3): For --cluster-only, For --update (incremental re-extraction), graphify reference: incremental update and cluster-only

## Knowledge Gaps
- **733 isolated node(s):** `roles`, `financial_categories`, `financial_records`, `rental_assets`, `site_content_blocks` (+728 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **57 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `AuthContext` connect `AuthContext` to `finance.repository.ts`, `membership.repository.ts`, `member.repository.ts`, `landing.controller.ts`, `share-capital.repository.ts`, `communication.repository.ts`, `payment-reference.repository.ts`, `auth.service.ts`, `errorHandler`, `membership-application.repository.ts`, `member-indicator.repository.ts`, `auth.types.ts`, `membership-application.controller.ts`, `membership-application.service.ts`, `asyncHandler`, `createMembershipApplicationController`, `MembershipApplicationRepository`, `UserRepository`, `membership-application.routes.test.ts`, `membership-application.types.ts`, `user.repository.ts`, `src/app.ts`, `member.routes.test.ts`, `member-indicator.controller.ts`, `MembershipApplicationBeneficiaryInput`, `NotificationRecord`?**
  _High betweenness centrality (0.087) - this node is a cross-community bridge._
- **Why does `withTransaction()` connect `transaction.ts` to `finance.repository.ts`, `membership.repository.ts`, `member.repository.ts`, `landing.controller.ts`, `rentalDatabase.ts`, `share-capital.repository.ts`, `communication.repository.ts`, `payment-reference.repository.ts`, `membership-application.repository.ts`, `member-indicator.repository.ts`, `user.repository.ts`, `auth.types.ts`?**
  _High betweenness centrality (0.057) - this node is a cross-community bridge._
- **Why does `AppError` connect `asyncHandler` to `finance.repository.ts`, `membership.repository.ts`, `member.repository.ts`, `landing.controller.ts`, `communication.types.ts`, `share-capital.repository.ts`, `communication.repository.ts`, `payment-reference.repository.ts`, `auth.service.ts`, `errorHandler`, `membership-application.repository.ts`, `member-indicator.repository.ts`, `membership-application.controller.ts`, `membership-application.service.ts`, `membership-application.types.ts`, `user.repository.ts`, `transaction.ts`, `user.controller.ts`, `member.controller.ts`, `[...path]/route.ts`, `payment-reference.controller.ts`, `member.routes.test.ts`, `execute`, `NotificationRecord`?**
  _High betweenness centrality (0.042) - this node is a cross-community bridge._
- **What connects `roles`, `financial_categories`, `financial_records` to the rest of the system?**
  _733 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `useRentalData` be split into smaller, more focused modules?**
  _Cohesion score 0.12092731829573934 - nodes in this community are weakly interconnected._
- **Should `finance.repository.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.052982456140350874 - nodes in this community are weakly interconnected._
- **Should `people-api.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.04760505436379665 - nodes in this community are weakly interconnected._