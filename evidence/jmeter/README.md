# JMeter evaluation — preliminary preparation

Status: **nine formal runs completed; some performance criteria failed**. The owner confirmed the configured remote database was development-only and authorized its use. Results, limitations and invalidated setup attempts are documented in the separate Word report and the files below. Do not interpret this evaluation as proof of production capacity or long-term reliability.

Baseline: `b68329235438e2f7986d898089beaf64e2b347f4` (`main`). The existing Playwright evidence and local changes were not modified. `environment.md` records the disposable database preparation and known safety issues; `request-groups.md` is a proposed, unvalidated mapping, not a claim of implemented coverage.

JMeter 5.6.3 was downloaded from Apache's distribution mirror and checked against Apache's SHA-512 file. The formal runs used verified Java 17. The loopback-only launcher disabled payment and email, gated requests and restricted outbound connections. Each formal run retains its JTL, log, HTML dashboard, run configuration, steady-state summary and pre/post integrity checks. Five preliminary executions are retained separately as invalidated setup evidence; see `invalidated/`.

The initializer in `scripts/initialize-schema.mjs` is intentionally one-shot: it only runs against the hard-coded local instance and data directory when all non-system schemas are absent. The current isolated schema already exists, so the initializer must refuse to run again. The directory under `scratch/` is ignored by Git and is not an archival backup.

`summaries/run-summary.csv` is the nine-run consolidated result. `summaries/request-group-summary.csv`, `summaries/transaction-summary.csv`, `summaries/calculations.json`, `summaries/acceptance-results.md`, `charts/`, `runs/`, and `integrity/` provide supporting evidence. The `scripts/audit-results.py` independent check recomputes the run-level statistics from original JTL rows. `reproduction.md` explains the setup and safe reproduction procedure.

The formal 300-second window excludes samples that start before the window or finish after it. In JMR09, 15 requests started within the window and finished afterward, with eventual elapsed times up to 37,858 ms; none was marked failed. This can bias its reported latency downward. All original samples are retained. The report describes the synthetic accounts, application-side referral initialization, rate-limit simulation, remote database topology, two connection-reset errors and excluded financial writes.
