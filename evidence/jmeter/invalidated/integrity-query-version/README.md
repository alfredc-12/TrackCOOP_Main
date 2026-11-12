# Invalidated two-second initial sequence

The first two executions after credential isolation used the correct application routes and preserved JTL, logs, dashboards and snapshots. They are not counted as formal acceptance runs because two snapshot checks used `financial_records.record_status='Posted'`, but the actual financial-record enum uses `Active`, `Corrected`, `Reversed`, and `Voided`; `Posted` applies to the share-capital ledger. The incorrect checks therefore could not establish the intended conditions.

The corrected snapshot uses active, approved, non-reversal financial records for duplicate rental/POS source checks; adds `financial_categories` to protected table checksums; and checks overlap between the application's actual `postedOperatingSql` and `capitalMovementSql` predicates. Ten active approved income-type records tagged as share capital were observed at preflight. The category label alone does not prove operating-income inclusion because the application's operating predicate excludes capital movements. The overlap check returned zero at the corrected preflight and is recorded alongside the diagnostic count, not by declaring all ten records failures.

The earlier snapshot implementation is preserved as `../integrity-v1.cjs`. These two executions remain separate from the replacement matrix. No application or financial business logic was changed.
