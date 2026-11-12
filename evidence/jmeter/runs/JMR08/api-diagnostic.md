# Unexpected HTTP 500 diagnostic

The local API emitted one error for `GET /api/rental/schedules` during JMR08. The diagnostic identified `ECONNRESET` (`read ECONNRESET`) while the authentication repository was looking up the session. The request returned HTTP 500 and is counted as an unexpected failed HTTP sample. A connection reset was observed; the available evidence does not establish whether the remote database, network, or another component caused it. No automatic retest replaced the original result.
