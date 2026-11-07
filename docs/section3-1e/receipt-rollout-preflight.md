# Receipt journal rollout preflight

The current receipt processor requires `20261107_receipt_attempt_recovery.sql`. Before a separately authorized deployment, the release owner must verify on the designated target (without using reset SQL):

1. The target identity, migration ledger, and `SHOW CREATE TABLE` for `payment_receipts`, `documents`, `payment_receipt_attempts` and `payment_receipt_attempt_events`, including unsigned BIGINT keys, unique attempt/object keys, enum states, foreign keys and InnoDB.
2. A verified restore procedure and forward-only migration plan, including how to handle in-flight old-version receipt workers. Coordinate worker shutdown and deployment ordering; an old worker can bypass the new attempt journal.
3. Both evidence migrations are installed and validated before starting this code. A missing or incompatible attempt table causes the claim transaction to roll back and the receipt operation to fail; do not use a legacy fallback or treat failure as payment reversal. Source settlement and receipt generation are separate; verify caller behavior and alerts in isolated staging before rollout.
4. The configured storage endpoint honors conditional creates; test privacy, immutable/version-specific access and lifecycle separately. Existing object keys and historical data are never backfilled or deleted by these migrations.
5. An authorized owner has reviewed how to investigate `PREPARED`, `STORED`, `FAILED` and `SUPERSEDED` entries. The unmounted inspection repository reports unknown object availability; no cleanup or abandoned-age policy is implemented. Do not delete potentially linked objects.

The G0-export parent-DDL rehearsal is not target verification or release approval. No production/staging connection or migration was performed for this PR.
