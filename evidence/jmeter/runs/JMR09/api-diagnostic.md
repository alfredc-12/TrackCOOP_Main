# Unexpected HTTP 500 diagnostic

The local API logged `read ECONNRESET` during the database query in the true-member authorization middleware for `GET /api/members/me/share-capital/overview`. The request returned HTTP 500 and is retained as an unexpected failure. This establishes the immediate error path but does not establish the underlying cause of the connection reset. No automatic replacement run was used.
