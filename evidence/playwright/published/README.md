# Playwright acceptance evidence

The isolated `database-resolution-final` run reported **61 passed, 0 failed, and 3 skipped** (64 tests). The skipped tests required the separately enabled PayMongo Test Mode service. This run preceded the final UI refinements and was not rerun on the merged PR #19 commit. Subsequent focused retests are described in [ENVIRONMENT.md](../ENVIRONMENT.md).

The test environment used synthetic data and a disposable database. These results do not establish production database compatibility, real payment handling, or external webhook delivery. The [coverage ledger](../coverage-ledger.json) records the 54 scenario dispositions and references both the consolidated run and individual earlier runs.

[results.json](results.json) and [report.html](report.html) are sanitized derivatives of the historical run. They intentionally omit logs, attachments, browser traces, session data and local paths. The two included activity screenshots depict synthetic test records.
