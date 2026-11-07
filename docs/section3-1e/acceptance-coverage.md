# PR 1E acceptance coverage

This matrix is for the draft implementation, not release approval. The master specification in Issue #8 and source-owned policies remain authoritative.

| Requirement | Status | Evidence / remaining dependency |
| --- | --- | --- |
| New receipt source metadata | Implemented and tested, limited | Central document insert; reduced-fixture producer MySQL test. Unknown historical links are not backfilled. |
| Concurrent receipt artifact writes | Implemented and tested, limited | Eight-worker local synthetic MySQL test; locked attempt generation, unique attempt keys and conditional create. Processing/generated requeues freeze receipt metadata; pre-finalization checks re-read the rendered receipt/payment source under locks. S3-compatible backend behavior and later source-writer coordination remain unverified. |
| Receipt attempt recovery | Partially implemented and deliberately restricted | The additive receipt attempt/event journal tracks prepared, stored, finalized, failed and superseded attempts without automatic deletion. An unmounted Chairman-only inspection reports journal states and audits access, without object paths or claims of object existence. Interrupted entries remain for investigation; no automated recovery, abandoned classification, cleanup or true process-kill/restart test exists. Target migration compatibility, production authorization and real storage behavior remain unverified. |
| New document upload checksum | Implemented and tested, limited | Validated upload digest is persisted; an upload digest is not object immutability or authorization. Older schema variants may lack the column. |
| Manual draft link/replacement/revocation | Implemented and tested, restricted | Internal-only maker-owned manual drafts; no production routes or trusted verification. Synthetic MySQL tests exercise concurrency and audit rollback. |
| Evidence versions, protected contents and downloads | Not implemented | Existing document version/storage services do not provide a demonstrated immutable, race-safe protected-object contract. |
| Local immutable private object identity | Deliberately restricted | No-follow diagnostic and exclusive creation are not immutable versioning; parent races and in-place mutation remain. |
| S3 immutable private object identity | Blocked by environment and code | Conditional request construction is tested without network, but provider compatibility, private access, object-version retention and verification are not established. |
| Diagnostic versus trusted verification | Implemented and tested, restricted | Unmounted receipt diagnostics return `kind: diagnostic` / `observed_match`, not a verified flag or finance fingerprint. No trusted verifier exists. |
| POS/rental/member/gateway evidence contracts | Not implemented | Cash POS diagnostic only; rental/noncash diagnostic returns unsupported. Payment source settlement remains authoritative. |
| Evidence authorization and audit | Partially implemented and deliberately restricted | Internal manual maker/Chairman read policy and audit exist; source/job/case and member/Associate access, file retrieval and consistent production endpoints remain open. |
| Controlled finance | Deliberately restricted | Default evidence verifier fails closed and controlled finance remains Inactive. No trusted adapter is connected. |
| Financial exception evidence | Not implemented | Case-source authorization and associations remain open; resolution and closure remain disabled. |
| Migration compatibility | Implemented but unverified on target | Synthetic MySQL rehearsal uses attested parent CREATE TABLE definitions and added primary keys, not full target migration state or deployed schema. |
| Retention, policy and rollout | Blocked by external prerequisites | Approved cooperative policies, immutable storage configuration, release review and explicit deployment/activation approval remain necessary. |

No direct public or staff evidence route may be mounted until its applicable object integrity, privacy, authorization, source and audit contracts are complete. No statement above approves implementation, merge, deployment or policy activation.
