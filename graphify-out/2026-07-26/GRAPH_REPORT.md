# Graph Report - .  (2026-07-26)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 2892 nodes · 6554 edges · 181 communities (124 shown, 57 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 34 edges (avg confidence: 0.72)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `2de0435f`
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
- @radix-ui/react-progress
- @radix-ui/react-select
- @radix-ui/react-tabs
- react-chartjs-2
- react-dom
- sonner
- tailwind-merge
- zod
- zustand
- supertest
- @tailwindcss/postcss
- tsx
- @types/cookie-parser
- @types/cors
- @types/express
- @types/react-dom
- @types/supertest
- postcss.config.mjs
- prettier.config.js
- 20260725_split_membership_application_applicant_name.sql
- config/app.ts
- lib/logger.ts
- global.ts

## God Nodes (most connected - your core abstractions)
1. `AuthContext` - 179 edges
2. `apiRequest()` - 73 edges
3. `AppError` - 49 edges
4. `CommunicationRepository` - 45 edges
5. `users` - 41 edges
6. `useRentalData()` - 38 edges
7. `requireApiUser()` - 36 edges
8. `getPool()` - 35 edges
9. `createCommunicationController()` - 34 edges
10. `formatRentalDate()` - 34 edges

## Surprising Connections (you probably didn't know these)
- `createCommunicationController()` --indirect_call--> `request()`  [INFERRED]
  server/src/modules/communication/communication.controller.ts → src/app/rental/_lib/rentalApi.ts
- `createMemberIndicatorController()` --indirect_call--> `indicator()`  [INFERRED]
  server/src/modules/member-indicators/member-indicator.controller.ts → tests/e2e/chairman-member-indicators.spec.ts
- `createMembershipApplicationController()` --indirect_call--> `request()`  [INFERRED]
  server/src/modules/membership-applications/membership-application.controller.ts → src/app/rental/_lib/rentalApi.ts
- `MemberIndicatorsClient()` --indirect_call--> `indicator()`  [INFERRED]
  src/app/(portal)/chairman/member-indicators/MemberIndicatorsClient.tsx → tests/e2e/chairman-member-indicators.spec.ts
- `run()` --calls--> `getPool()`  [EXTRACTED]
  scripts/get-members.ts → server/src/db/pool.ts

## Import Cycles
- None detected.

## Communities (181 total, 57 thin omitted)

### Community 0 - "useRentalData"
Cohesion: 0.07
Nodes (29): columns, EquipmentAvailabilityBoard(), RentalAccessGate(), RentalAnalyticsView(), RentalUtilizationView(), RentalAudit(), RentalChartCard(), loader() (+21 more)

### Community 1 - "finance.repository.ts"
Cohesion: 0.05
Nodes (41): createFinanceController(), parseBody(), requireAuth(), requireParam(), validationError(), voidRecordSchema, CategoryRow, CountRow (+33 more)

### Community 2 - "people-api.ts"
Cohesion: 0.05
Nodes (68): MemberAccountLinkDialog(), accountStatuses, ActionKind, actionStatus(), actionTitle(), ActivationResultDialog(), blankForm, formatDate() (+60 more)

### Community 3 - "membership.repository.ts"
Cohesion: 0.05
Nodes (36): createMembershipController(), parse(), parseJson(), requireParam(), sendProtectedFile(), uploadedDocuments(), ApplicationRow, CountRow (+28 more)

### Community 4 - "member.repository.ts"
Cohesion: 0.06
Nodes (37): createMemberController(), CountRow, createMemberRepository(), HistoryRow, LatestIndicatorRow, MemberRepository, MemberRow, PaymentActivityRow (+29 more)

### Community 5 - "MembersClient.tsx"
Cohesion: 0.05
Nodes (47): ApplicationDetailDialog(), ApplicationFormDialog(), ApplicationFormState, applicationFullName(), ApplicationsResponsiveList(), blankApplication, blankMemberForm, ConfirmAction (+39 more)

### Community 6 - "landing.controller.ts"
Cohesion: 0.07
Nodes (39): createLandingController(), createSchemas, parse(), requireAuth(), requireCollection(), requireParam(), updateSchemas, validationError() (+31 more)

### Community 7 - "communication.types.ts"
Cohesion: 0.06
Nodes (51): parse(), requestContext(), requireAuth(), requireParam(), validationError(), archiveReportSchema, baseRequestSchema, createAnnouncementSchema (+43 more)

### Community 8 - "share-capital.repository.ts"
Cohesion: 0.07
Nodes (29): createShareCapitalController(), parseBody(), requireAuth(), requireParam(), validationError(), CountRow, createShareCapitalRepository(), ProgressRow (+21 more)

### Community 9 - "TrackCOOP_MAIN_Database.sql"
Cohesion: 0.11
Nodes (50): `announcement_acknowledgments`, announcement_recipients, announcements, audit_logs, document_access_logs, documents, financial_categories, financial_records (+42 more)

### Community 10 - "communication.repository.ts"
Cohesion: 0.05
Nodes (31): AnnouncementRow, announcementSortColumns, CountRow, CreateAnnouncementInput, CreateDocumentInput, CreateReportInput, CreateRequestInput, DocumentRow (+23 more)

### Community 11 - "rental.ts"
Cohesion: 0.08
Nodes (37): AssetDetailsData, ChairmanRentalAssetDetails(), formatDate(), formatDateRange(), isPublicRentalPath(), RentalContext, RentalContextValue, RentalProvider() (+29 more)

### Community 12 - "components/MembershipApplicationForm.tsx"
Cohesion: 0.06
Nodes (32): ApplicationProgress(), steps, ApplicationSuccess(), ApplicationSuccessProps, BeneficiaryFields(), BeneficiaryFieldsProps, CommitmentReview(), CommitmentReviewProps (+24 more)

### Community 13 - "api-client.ts"
Cohesion: 0.08
Nodes (31): createMembershipAccount(), getMembershipApplication(), lookupMembershipApplication(), MembershipApplication, MembershipDraft, PublicApplicationStatus, reviewMembershipApplication(), submitAdditionalInformation() (+23 more)

### Community 14 - "requireApiUser"
Cohesion: 0.08
Nodes (26): GET(), DELETE(), InventoryProductUpdateInput, PUT(), InventoryBalanceRow, POST(), GET(), InventoryProductInput (+18 more)

### Community 15 - "payment-reference.repository.ts"
Cohesion: 0.11
Nodes (20): limitOffsetSql(), normalizeSqlInteger(), createPaymentReferenceController(), CountRow, createPaymentReferenceRepository(), PaymentReferenceRepository, PaymentRow, sortColumns (+12 more)

### Community 16 - "auth.service.ts"
Cohesion: 0.14
Nodes (25): createAuthenticate(), requireRoles(), createRoleApp(), AuthService, AuthServiceOptions, createAuthService(), defaultOptions, LoginRequest (+17 more)

### Community 17 - "membership-application-api.ts"
Cohesion: 0.07
Nodes (36): ApplicationStatusLookup(), StatusFormValues, statusSchema, ApiFailure, ApiSuccess, getMembershipApplicationStatus(), ApprovalInput, ApprovalResult (+28 more)

### Community 18 - "AuthContext"
Cohesion: 0.15
Nodes (6): AuthContext, createCommunicationController(), CommunicationRepository, CommunicationService, AnnouncementRecord, DocumentRecord

### Community 19 - "TrackCOOP_Table_Reference_Only.sql"
Cohesion: 0.11
Nodes (40): announcement_recipients, announcements, audit_logs, document_access_logs, documents, financial_categories, financial_records, gallery_items (+32 more)

### Community 20 - "errorHandler"
Cohesion: 0.08
Nodes (26): errorHandler(), createErrorApp(), auth, user, AuthUser, createLandingRouter(), baseUser, createApp() (+18 more)

### Community 21 - "membership-application.repository.ts"
Cohesion: 0.06
Nodes (28): allowedTransitions, applicationSelect(), BeneficiaryRow, ChairmanApplicationRow, CountRow, dateMonthsFromNow(), defaultSettings, DocumentRow (+20 more)

### Community 22 - "FinanceViews.tsx"
Cohesion: 0.10
Nodes (21): FinancialCategory, FinancialRecord, FinancialSummary, getFinancialSummary(), getShareCapitalSummary(), listFinancialCategories(), listFinancialRecords(), listPaymentReferences() (+13 more)

### Community 23 - "member-indicator.repository.ts"
Cohesion: 0.08
Nodes (26): ActivityMetricRow, addUtcMonths(), CountRow, createMemberIndicatorRepository(), dateToTime(), daysSince(), fallbackThresholds, IndicatorRow (+18 more)

### Community 24 - "useRental"
Cohesion: 0.10
Nodes (20): RentalBreadcrumbs(), RentalHeader(), roles, items, RentalMobileNavigation(), RentalModuleShell(), links, RentalPublicHeader() (+12 more)

### Community 25 - "SiteHeader.tsx"
Cohesion: 0.08
Nodes (12): boardMembers, metadata, classifications, metadata, metadata, contactCards, metadata, socialLinks (+4 more)

### Community 26 - "(LandingPage)/page.tsx"
Cohesion: 0.06
Nodes (13): certifications, CertificationSlide, fadeUp, heroFloatingSeeds, heroSeedlings, heroSlides, photos, Project (+5 more)

### Community 27 - "auth.types.ts"
Cohesion: 0.09
Nodes (14): AuthRepository, createAuthRepository(), CreateSessionInput, FailedLoginInput, LoginAccountRow, SessionRow, SessionSummaryRow, activeAccount (+6 more)

### Community 28 - "membership-application.controller.ts"
Cohesion: 0.10
Nodes (24): authContext(), documentFile(), MulterFile, parse(), publicContext(), trackingToken(), UploadRequest, validationError() (+16 more)

### Community 29 - "members/service.ts"
Cohesion: 0.11
Nodes (20): GET(), GET(), GET(), Column, DataTable(), DataTableProps, MemberTable(), getMemberById() (+12 more)

### Community 30 - "formatRentalDate"
Cohesion: 0.10
Nodes (15): RentalInquirySuccess(), RentalInquiryMobileCard(), RentalInquiryTable(), tabs, RentalReports(), RentalRequestDetails(), ScheduleList(), RentalStatusBadge() (+7 more)

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
Cohesion: 0.10
Nodes (18): addPdfLine(), allowedDocuments, buildPrintablePdf(), hashToken(), isAllowedMembershipDocumentExtension(), isAllowedMembershipDocumentMimeType(), normalizeChairmanApplication(), normalizeContact() (+10 more)

### Community 35 - "next-api-auth.ts"
Cohesion: 0.11
Nodes (18): GET(), CheckoutItem, CheckoutPayload, CheckoutProductRow, getErrorMessage(), POST(), StaffRecorderRow, GET() (+10 more)

### Community 36 - "auth-client.ts"
Cohesion: 0.11
Nodes (20): LoginPage(), roleDestinations, destinations, PortalRedirectPage(), MemberDashboardPage(), destinations, PortalAuthGuard(), requiredRole() (+12 more)

### Community 37 - "asyncHandler"
Cohesion: 0.11
Nodes (20): booleanString, envSchema, parsedEnv, ServerEnvironment, cookieOptions(), createAuthController(), requestContext(), validationError() (+12 more)

### Community 38 - "RentalInquiryReview.tsx"
Cohesion: 0.10
Nodes (9): RentalInquiryReview(), RentalInquiryStepper(), steps, RentalPolicyNotice(), RentalServiceBrowser(), iconForCategory(), RentalServiceCard(), RentalServiceDetails() (+1 more)

### Community 39 - "rentalDatabase.ts"
Cohesion: 0.08
Nodes (17): AssetRow, AuditRow, BookingRow, dateKeysBetween(), DbExecutor, DbValue, defaultSafetyReminders, ExpenseRow (+9 more)

### Community 40 - "createMembershipApplicationController"
Cohesion: 0.17
Nodes (4): createMembershipApplicationController(), MembershipApplicationService, ChairmanApplicationDetail, StatusTransitionInput

### Community 41 - "MembershipApplicationRepository"
Cohesion: 0.11
Nodes (10): MembershipApplicationRepository, FakeMembershipApplicationRepository, ApprovalResult, ChairmanApplicationHistoryEntry, ChairmanApplicationSummary, ChairmanMembershipApplicationInput, MembershipSettings, PublicMembershipApplicationInput (+2 more)

### Community 42 - "MembershipPaymentsView.tsx"
Cohesion: 0.13
Nodes (16): ChairmanAnnouncementsClient(), PageHeader(), PageHeaderProps, DataTable(), EmptyState(), StatCard(), env, listMembershipApplications() (+8 more)

### Community 43 - "MemberIndicatorsClient.tsx"
Cohesion: 0.12
Nodes (19): emptySummary, formatCurrency(), formatDate(), IndicatorDetailDialog(), indicatorTone(), MemberIndicatorsClient(), parseBasisSummary(), scoreLabel() (+11 more)

### Community 44 - "ChairmanRentalBookingDetails.tsx"
Cohesion: 0.13
Nodes (16): ChairmanRentalBookingDetails(), displayDate(), displayDateRange(), ReviewDraft, ScheduleDraft, tone(), BookingActions(), assertRentalStatusTransition() (+8 more)

### Community 45 - "UserRepository"
Cohesion: 0.18
Nodes (5): createUserController(), UserRepository, UserService, UserDetail, UserSummaryCounts

### Community 46 - "PortalShell.tsx"
Cohesion: 0.16
Nodes (15): Breadcrumbs(), titleize(), findPortalNavItem(), getPortalRoleFromPath(), PortalNavGroup, portalNavigation, PortalNavItem, roleHomePaths (+7 more)

### Community 47 - "RentalMemberArea.tsx"
Cohesion: 0.11
Nodes (9): RentalMemberHome(), RentalMemberNewRequest(), RentalMemberPaymentProof(), RentalMemberRequestDetails(), RentalMemberRequests(), RentalMemberReschedule(), RentalMetricCard(), RentalRequestTimeline() (+1 more)

### Community 48 - "RentalPayments.tsx"
Cohesion: 0.11
Nodes (12): emptyPayment, RentalPaymentDetails(), RentalPaymentForm(), RentalPaymentsList(), BARANGAYS, EXPENSE_CATEGORIES, paymentStatusTone, rentalStatusTone (+4 more)

### Community 49 - "getPool"
Cohesion: 0.16
Nodes (17): run(), app, getDatabaseConfig(), closePool(), createPoolOptions(), getPool(), probeDatabase(), server (+9 more)

### Community 50 - "membership-application.routes.test.ts"
Cohesion: 0.07
Nodes (18): applicationFullName(), chairmanUser, createAuthService(), createChairmanApp(), CreatedApplication, createTestApp(), defaultSettings, detail() (+10 more)

### Community 51 - "scripts"
Cohesion: 0.09
Nodes (22): scripts, build, build:api, build:web, db:check, db:migrate:rental, db:seed, dev (+14 more)

### Community 52 - "membership-application.types.ts"
Cohesion: 0.10
Nodes (17): ChairmanApplicationListItem, ChairmanApplicationRequirement, CivilStatus, civilStatuses, documentTypes, MembershipApplicationDocumentType, MembershipApplicationSource, membershipApplicationSources (+9 more)

### Community 53 - "ChairmanRentalAssetsClient.tsx"
Cohesion: 0.13
Nodes (12): AssetMobileCard(), AssetRow(), AssetStatusFilter, ChairmanRentalAssetsClient(), displayDate(), displayDateRange(), matchesStatusFilter(), PendingAction (+4 more)

### Community 54 - "RentalInquiryForm.tsx"
Cohesion: 0.16
Nodes (16): addMonths(), AvailabilityCalendar(), dateKeysBetween(), defaultValues, Field(), firstBlockedDateInRange(), flattenErrors(), localDateKey() (+8 more)

### Community 55 - "compilerOptions"
Cohesion: 0.10
Nodes (20): dist, node, src/**/*.d.ts, src/**/*.test.ts, src/**/*.ts, compilerOptions, esModuleInterop, forceConsistentCasingInFileNames (+12 more)

### Community 57 - "member_dashboard/page.tsx"
Cohesion: 0.16
Nodes (9): ActivityItem, HelpCenter(), Ticket, ProfileSettings(), Button(), ButtonProps, buttonVariants, Modal() (+1 more)

### Community 58 - "user.repository.ts"
Cohesion: 0.11
Nodes (11): CountRow, LinkableMemberRow, RoleRow, SessionRow, SettingRow, sortColumns, SummaryRow, UserRow (+3 more)

### Community 59 - "MembershipPublicShell.tsx"
Cohesion: 0.15
Nodes (6): activateMembershipAccount(), MembershipActivationForm(), MembershipFollowUpForm(), MembershipPublicShell(), LastSubmission, MembershipSuccess()

### Community 60 - "MembersClient"
Cohesion: 0.11
Nodes (13): MembersClient(), getMemberDetail(), getMemberSummary(), listMembers(), listMembersPaginated(), listUnifiedStatusHistory(), deleteApplicationBeneficiary(), deleteApplicationDocument() (+5 more)

### Community 62 - "stringValue"
Cohesion: 0.20
Nodes (18): isPaymentStatus(), isRentalStatus(), isScheduleStatus(), mapAsset(), mapBooking(), mapSchedule(), operationalStatus(), paymentStatusFromBooking() (+10 more)

### Community 63 - "PortalPrimitives.tsx"
Cohesion: 0.15
Nodes (9): ConfirmDialog(), CurrencyDisplay(), FormDialog(), LoadingAccess(), StatusBadge(), SidebarContent(), Input(), InputProps (+1 more)

### Community 64 - "devDependencies"
Cohesion: 0.12
Nodes (17): eslint, eslint-config-next, devDependencies, eslint, eslint-config-next, tailwindcss, @types/multer, @types/node (+9 more)

### Community 65 - "src/app.ts"
Cohesion: 0.24
Nodes (10): createApp(), CreateAppOptions, createCorsOptions(), notFound(), SAFE_METHODS, validateOrigin(), requestId(), requestLogger() (+2 more)

### Community 66 - "transaction.ts"
Cohesion: 0.18
Nodes (12): withTransaction(), ExistingUserRow, provisionAccount(), ProvisionAccountInput, RoleRow, argumentsSchema, main(), parseArguments() (+4 more)

### Community 67 - "ChairmanPosInventoryClient.tsx"
Cohesion: 0.13
Nodes (11): CategoryComboboxProps, ChairmanPosInventoryClient(), EditableInventoryItem, formatQuantityUnit(), InventoryItem, PosOrder, PosOrderItem, STOCK_UNIT_OPTIONS (+3 more)

### Community 68 - "user.controller.ts"
Cohesion: 0.22
Nodes (14): parseBody(), requireParam(), validationError(), accountStatuses, createUserSchema, issueActivationLinkSchema, linkMemberSchema, listLinkableMembersQuerySchema (+6 more)

### Community 69 - "member.controller.ts"
Cohesion: 0.19
Nodes (12): parseBody(), requireParam(), approvalStatuses, listMembersQuerySchema, listUnifiedStatusHistoryQuerySchema, memberProfileSchema, membershipTypes, officialMemberStatuses (+4 more)

### Community 70 - "user.service.test.ts"
Cohesion: 0.15
Nodes (9): createUserService(), chairmanAuth, CreateCallInput, userDetail, userSummary, UpdateUserInput, UpdateUserRoleInput, UpdateUserStatusInput (+1 more)

### Community 71 - "[...path]/route.ts"
Cohesion: 0.31
Nodes (14): normalizeProtectedStoragePath(), authorize(), authorizeActor(), badRequest(), body(), GET(), json(), notFound() (+6 more)

### Community 72 - "ChairmanRentalCalendar.tsx"
Cohesion: 0.25
Nodes (11): CalendarView, ChairmanRentalCalendar(), formatDate(), formatDateRange(), localDateKey(), monthDays(), MonthGrid(), parseDate() (+3 more)

### Community 73 - "ChairmanRentalBookingsClient.tsx"
Cohesion: 0.21
Nodes (11): BookingMobileCard(), BookingRow(), BookingView, bookingViews, ChairmanRentalBookingsClient(), formatDate(), formatDateRange(), matchesBookingView() (+3 more)

### Community 74 - "user.service.ts"
Cohesion: 0.19
Nodes (8): createUserRepository(), activationUrl(), createActivation(), hashToken(), ActivationLinkResult, CreateUserInput, LinkableMember, UserMutationResult

### Community 75 - "usePublishedLandingContent.ts"
Cohesion: 0.23
Nodes (12): Home(), GalleryGrid(), photos, asString(), emptyPayload, mapPublishedCertifications(), mapPublishedProjects(), mapPublishedServices() (+4 more)

### Community 76 - "RentalServiceForm.tsx"
Cohesion: 0.16
Nodes (5): initial, RentalServiceForm(), AvailabilityStatus, OperationalStatus, ServiceVisibility

### Community 77 - "MemberPosClient.tsx"
Cohesion: 0.16
Nodes (9): StorePublicHeader(), CartItem, formatQuantityUnit(), InventoryItem, MemberPosClient(), MemberPosClientProps, PosOrder, PosOrderItem (+1 more)

### Community 78 - "createMemberIndicatorController"
Cohesion: 0.27
Nodes (5): createMemberIndicatorController(), MemberIndicatorRepository, MemberIndicatorService, MemberIndicator, MemberIndicatorSummary

### Community 79 - "payment-reference.controller.ts"
Cohesion: 0.22
Nodes (10): parseBody(), requireAuth(), requireParam(), validationError(), listPaymentReferencesQuerySchema, paymentPurposes, paymentReferenceSchema, reviewPaymentReferenceSchema (+2 more)

### Community 80 - "ChairmanRentalAssetEditor.tsx"
Cohesion: 0.18
Nodes (4): blank, ChairmanRentalAssetEditor(), ErrorState(), LoadingSkeleton()

### Community 81 - "RentalScheduleForm.tsx"
Cohesion: 0.24
Nodes (6): RentalConflictModal(), blank, RentalScheduleForm(), scheduleCandidate(), schedulePayload(), scheduleWithInquiry()

### Community 82 - "proxy.ts"
Cohesion: 0.23
Nodes (12): AuthPayload, canonicalPath(), config, getSessionRole(), internalPath(), isRole(), landingPaths, loginRedirect() (+4 more)

### Community 83 - "schema-check.ts"
Cohesion: 0.33
Nodes (7): expectedDatabaseTables, checkDatabaseSchema(), compareDatabaseTables(), DatabaseTableRow, SchemaComparison, getErrorCode(), main()

### Community 84 - "rentalValidation.ts"
Cohesion: 0.24
Nodes (9): fileRules, InquiryFormValues, inquirySchema, optionalText, rentalRescheduleSchema, rentalScheduleSchema, rentalServiceSchema, requiredConsent (+1 more)

### Community 85 - "isoDateTime"
Cohesion: 0.25
Nodes (11): datePart(), isoDateTime(), mapAudit(), mapExpense(), mapMaintenance(), mapNotification(), mapPayment(), mapStatusHistory() (+3 more)

### Community 86 - "member.routes.test.ts"
Cohesion: 0.33
Nodes (7): createMemberRouter(), chairman, createApp(), createAuthService(), createMemberService(), memberDetail, createMemberService()

### Community 87 - "execute"
Cohesion: 0.33
Nodes (10): actorUserId(), addNotification(), addRentalAudit(), addStatusHistory(), cleanParams(), execute(), nextReferenceNumber(), rentalCategoryId() (+2 more)

### Community 88 - "dependencies"
Cohesion: 0.22
Nodes (9): bcryptjs, multer, dependencies, bcryptjs, multer, react, react-hook-form, react (+1 more)

### Community 89 - "inventoryQueries.ts"
Cohesion: 0.31
Nodes (7): GET(), InventoryMovementRow, InventoryProduct, InventoryProductRow, listInventoryProducts(), ListInventoryProductsOptions, mapProductStatus()

### Community 90 - "PosSalesClient.tsx"
Cohesion: 0.25
Nodes (4): formatMoney(), PosOrder, PosOrderItem, PosSalesClient()

### Community 91 - "persistedScheduleConflict"
Cohesion: 0.25
Nodes (9): assetRows(), bookingByRentalId(), bookingByScheduleId(), bookingRows(), paymentByPaymentId(), paymentRows(), persistedScheduleConflict(), queryRows() (+1 more)

### Community 92 - "database.ts"
Cohesion: 0.36
Nodes (5): DatabaseConfig, databaseEnvSchema, parseDatabaseConfig(), getServerEnvPath(), loadServerEnv()

### Community 93 - "member-indicator.controller.ts"
Cohesion: 0.36
Nodes (6): parseBody(), requireParam(), validationError(), indicatorStatuses, listMemberIndicatorsQuerySchema, recalculateIndicatorsSchema

### Community 94 - "20260724_add_membership_application_workflow.sql"
Cohesion: 0.52
Nodes (6): membership_application_beneficiaries, membership_application_documents, membership_application_requirements, membership_application_status_history, membership_applications, user_activation_tokens

### Community 95 - "20260724_membership_applications.sql"
Cohesion: 0.48
Nodes (6): membership_account_activations, membership_application_documents, membership_application_notes, membership_application_payments, membership_application_status_history, membership_applications

### Community 99 - "confirm/route.ts"
Cohesion: 0.33
Nodes (5): FinancialCategoryRow, InventoryBalanceRow, PosSaleItemRow, PosSaleStatusRow, PUT()

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
Nodes (4): apiPort, envelope(), indicator(), mockApiResponse()

### Community 107 - "chairman-membership-applications.spec.ts"
Cohesion: 0.60
Nodes (4): apiPort, detail(), envelope(), mockApiResponse()

### Community 108 - "package.json"
Cohesion: 0.50
Nodes (3): name, private, version

### Community 109 - "20260723_rental_operations.sql"
Cohesion: 0.50
Nodes (3): rental_booking_sequences, rental_idempotency_keys, rental_maintenance_periods

## Knowledge Gaps
- **579 isolated node(s):** `roles`, `financial_categories`, `financial_records`, `rental_assets`, `site_content_blocks` (+574 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **57 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `AuthContext` connect `AuthContext` to `finance.repository.ts`, `membership.repository.ts`, `member.repository.ts`, `landing.controller.ts`, `share-capital.repository.ts`, `communication.repository.ts`, `payment-reference.repository.ts`, `auth.service.ts`, `errorHandler`, `membership-application.repository.ts`, `member-indicator.repository.ts`, `auth.types.ts`, `membership-application.controller.ts`, `membership-application.service.ts`, `asyncHandler`, `createMembershipApplicationController`, `MembershipApplicationRepository`, `UserRepository`, `getPool`, `membership-application.routes.test.ts`, `membership-application.types.ts`, `user.repository.ts`, `user.service.test.ts`, `user.service.ts`, `createMemberIndicatorController`, `member.routes.test.ts`, `RequestRecord`, `MembershipApplicationBeneficiaryInput`, `ReportRecord`, `NotificationRecord`, `express.d.ts`?**
  _High betweenness centrality (0.114) - this node is a cross-community bridge._
- **Why does `withTransaction()` connect `transaction.ts` to `finance.repository.ts`, `membership.repository.ts`, `member.repository.ts`, `landing.controller.ts`, `rentalDatabase.ts`, `share-capital.repository.ts`, `communication.repository.ts`, `payment-reference.repository.ts`, `membership-application.repository.ts`, `member-indicator.repository.ts`, `user.repository.ts`, `auth.types.ts`?**
  _High betweenness centrality (0.082) - this node is a cross-community bridge._
- **Why does `MembershipRepository` connect `membership.repository.ts` to `MembersClient.tsx`?**
  _High betweenness centrality (0.055) - this node is a cross-community bridge._
- **What connects `roles`, `financial_categories`, `financial_records` to the rest of the system?**
  _579 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `useRentalData` be split into smaller, more focused modules?**
  _Cohesion score 0.0694938440492476 - nodes in this community are weakly interconnected._
- **Should `finance.repository.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.052982456140350874 - nodes in this community are weakly interconnected._
- **Should `people-api.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05045045045045045 - nodes in this community are weakly interconnected._