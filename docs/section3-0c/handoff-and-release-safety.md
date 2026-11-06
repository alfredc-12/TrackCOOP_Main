# PR 0C handoff and release safety

Source baseline `740def0e611d77734b45a13d2f2f675ff635e5cc`; this is a source audit, not a deployment attestation. See [contract/security inventory](contract-security-inventory.md) and [literal SQL write sites](literal-write-sites.md).

## CI and deployment inventory

At this commit `.github/workflows/ci.yml` starts for pull requests targeting main and pushes to main; its Quality Gate runs checks. The baseline main Quality Gate passed on GitHub. Both `.github/workflows/verpex-api-deploy.yml` and `verpex-web-build.yml` have `workflow_dispatch` as their only trigger, restrict the staging jobs to `github.ref == 'refs/heads/main'`, and checkout `${{ github.sha }}` from the manually selected ref. A main merge does not trigger either workflow through these repository definitions. The production workflows are dispatch-only and validate an explicitly supplied commit; verify their specific input and authorization controls rather than assuming they use the staging branch rule. `.github/workflows/verpex-ssh-check.yml` includes a path-filtered main push, but is an SSH check rather than a staging deployment workflow. `vercel.json` disables Git deployments in repository configuration.

No automatic migration step was found in the main Quality Gate/workflow definitions reviewed. This does not prove that an externally configured platform, service hook, startup script, operator or other repository cannot deploy or migrate. Vercel, Railway, hosting control panels, webhook integrations, deployment branch rules, object storage ACLs and running worker settings are not verified by this source review. No workflow was dispatched and no environment contacted in PR 0C.

### Before merging a later PR

- [ ] Confirm latest `origin/main`, PR head SHA, intended changed files and no competing Section 4 changes; obtain required reviewers.
- [ ] Verify PR Quality Gate and explicitly list skipped/non-run SQL and browser suites. Inspect all workflow triggers and any changed deployment/configuration files.
- [ ] Confirm automatic CI remains enabled and staging/production deployments are still manual-only; check any external deployment integrations separately.
- [ ] Check migration compatibility and coordinating deployment requirements before approving finance changes; a main merge is not deployment authorization.
- [ ] Confirm no source rules, authorization, financial formulas or persisted data changed outside reviewed scope.

### Before a separately authorized deployment

- [ ] Obtain explicit staging or production authorization, identify exact SHA, operator, target, environment and manual dispatch inputs. Never dispatch for this inventory.
- [ ] Verify current target schema and additive migrations against the intended SHA; do not use reset SQL or assume the owner-attested export proves the target state.
- [ ] Verify approved restore process, safe server-side recovery point, worker/app DB targets, isolation, secrets, PayMongo live/test separation and storage ACLs without exposing secrets.
- [ ] Verify policy configuration, activation manifest and every guarded old/new writer before activating controlled finance. Do not infer an approved threshold or category schedule.
- [ ] Run authorized synthetic smoke and rollback checks; record outcomes, unresolved exceptions, and access controls. No production financial records in automated tests.

## Handoff dependencies

| PR | Scope and prerequisites / blockers |
| --- | --- |
| **1A** | Versioned threshold and restricted-category policy states, including absent/draft/approved-empty/approved-set. Exact monetary threshold and approved restriction schedule remain cooperative decisions. Implement configuration without activation; approved inputs and guarded writer manifest block routine automated posting. |
| **1B** | Deterministic exact-season/general fallback, immutable or demonstrably replay-stable historical attribution, unbudgeted/ambiguous behavior, posted consumption, pending commitments and locking. Existing historical attribution is unresolved. Isolated MySQL race and schema compatibility tests are required before hard-limit enforcement. |
| **1C** | Depends on 1A/1B; enumerate all old/new protected manual writers, enforce one common transactional gate, evidence, independent checker, state/version and concurrency checks. Preserve source-specific gateway, POS/rental, capital and existing PR #6/#7 authorities. Activation and any unapproved configuration block release. |
| **1D** | Exception identity, ownership, workflow and immutable audit events; depends on source mappings and authorization contracts. Never auto-correct financial records merely because an exception exists. |
| **1E** | Protected source-to-evidence links; document and linked-source checks, receipt identity, file access and source roles. Depends on document ownership guard; historical ownerless classification is unresolved and must not be inferred. |
| **2B** | Unified read inbox and source-owned actions; relies on 1C/1D/1E and Section 4 contract review. Never create a new settlement writer. |
| **2D** | Reconciliation with date basis, distinct source populations, immutable close and late events; depends on source and evidence identities plus exceptions. |
| **3C1** | Explicit publication permission and oversight across upload, visibility change, report save and alternate document writers; address current Bookkeeper broad-visibility gap. |
| **3C2** | Controlled report publication and withdrawal; depends on 3C1, field/row authorization and explicit audience. |
| **4A–4C** | Reconciled financial bases, report builder allowlists, consistent immutable dataset and current authorization on export. Preserve distinct dividend/patronage policy pending separate financial approval. |
| **5A–5B** | Ownerless classification/explicit shared designation, protected evidence/version lifecycle, self-service member statements with True/Associate action-level rules. Do not create a shared classification from null owner. |
| **6A–6B** | Integrated source/role/browser and isolated-MySQL concurrency tests; schema/deployment verification and separately authorized release. |

## G0–G9 evidence still needed

| Gate | Evidence remaining or limitation |
| --- | --- |
| G0 | Reverify target SHA, schema/migrations, runtime app and worker targets before deployment; the export hash is not runtime proof. |
| G1 | PR #9 privacy tests are useful source evidence; ownerless legacy inventory, classification, stored-object ACLs and deployed access paths remain unverified. |
| G2 | Extend fixture comparisons to equivalent dashboard/ledger/report scopes; document distinct dividend/patronage definitions, with no formula changes without signoff. |
| G3 | Execute source-specific duplicate/concurrency, webhook signature/environment and settlement tests on a disposable MySQL target; source code alone proves no exactly-once guarantee. |
| G4 | Execute activated policy, all legacy/alternate bypass, threshold/schedule states, hard-budget fallback and racing-spend tests in isolated MySQL. No policy activated in 0C. |
| G5 | Complete desktop/tablet/mobile and accessible Bookkeeper workflow testing after relevant UX exists. |
| G6 | Maker-checker, approvals, publication and audit tests after implementation. |
| G7 | Snapshot format parity, current-role/field reauthorization, classification and document version tests after implementation. |
| G8 | Section 4 signoff and integrated contract tests. |
| G9 | Named CI, SQL, privacy, concurrency, browser results; target schema/restore/activation verification and explicit deployment authorization. A green Quality Gate does not prove optional SQL suites ran. |

**Next:** review and merge PR 0C before starting PR 1A. A merge does not authorize staging or production deployment.
