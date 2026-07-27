# PayMongo sandbox workflow

1. Switch the PayMongo dashboard to Test Mode.
2. Obtain a test secret key.
3. Store it only in `server/.env`.
4. Configure the test webhook secret.
5. Configure supported test payment methods.
6. Configure the dedicated PayMongo system actor.
7. Back up and apply the required migrations manually.
8. Start the web and API processes.
9. Expose API port 5000 through an HTTPS development tunnel.
10. Register `<tunnel>/api/webhooks/paymongo`.
11. Subscribe to `checkout_session.payment.paid`.
12. Submit a public membership application.
13. Start checkout and test cancellation; confirm TrackCOOP does not claim payment.
14. Complete a successful membership-fee payment.
15. Redeliver the webhook and confirm idempotency.
16. Create a controlled failed settlement and use Bookkeeper retry.
17. Complete two PHP 1,500 Share Capital installments.
18. Approve the application through the Chairman workflow.
19. Confirm capital, finance, history, and receipt entries exactly once.
20. Sign in as the Member and test an owner-only contribution.
21. Confirm Rental and POS purposes are blocked from this membership settlement path.

Use test credentials only. Never place actual keys in documentation, browser environment variables, screenshots, logs, or commits.
