import type { Pool, ResultSetHeader } from "mysql2/promise";

const rentalAmountSql = `COALESCE(
  NULLIF(rb.total_amount, 0),
  CASE WHEN JSON_VALID(rb.purpose)
    THEN CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(rb.purpose, '$.estimatedFee.total')), '') AS DECIMAL(12,2))
    ELSE NULL END,
  rb.rate_amount + rb.deposit_amount + rb.additional_charges - rb.discount_amount
)`;

export async function syncMissingRentalPaymentReferencesForReview(
  pool: Pick<Pool, "execute">,
) {
  await pool.execute<ResultSetHeader>(
    `INSERT INTO payment_references
       (member_id, submitted_by, payer_name, payer_email, payer_contact,
        provider, payment_channel, gateway_environment, reference_number,
        payment_purpose, related_entity_type, related_entity_id, amount,
        proof_file_path, validation_status, idempotency_key, notes, submitted_at)
     SELECT rb.member_id,
            NULL,
            rb.requester_name,
            mp.email,
            rb.requester_contact,
            'Cash',
            'Cash',
            'Manual',
            CONCAT('RENTAL-CASH-', rb.booking_number),
            'Rental',
            'rental_bookings',
            rb.rental_booking_id,
            ${rentalAmountSql},
            NULL,
            'Pending',
            CONCAT('rental-payment-review:', rb.rental_booking_id),
            JSON_OBJECT(
              'status', 'Under Review',
              'paymentMethod', 'Cash',
              'recordedBy', 'TrackCOOP',
              'scheduleDate', DATE(rb.start_datetime),
              'paymentDate', DATE(COALESCE(rb.updated_at, rb.created_at)),
              'notes', 'Auto-created so the bookkeeper can review this rental payment.'
            ),
            CURRENT_TIMESTAMP
       FROM rental_bookings rb
       LEFT JOIN member_profiles mp ON mp.member_id = rb.member_id
      WHERE rb.payment_reference_id IS NULL
        AND rb.payment_status IN ('Unpaid', 'Partially Paid')
        AND rb.booking_status IN ('Approved', 'Scheduled', 'In Use', 'Completed', 'Rescheduled')
        AND ${rentalAmountSql} > 0
      ON DUPLICATE KEY UPDATE payment_references.updated_at = payment_references.updated_at`,
  );

  await pool.execute<ResultSetHeader>(
    `UPDATE rental_bookings rb
       JOIN payment_references pr
         ON pr.payment_purpose = 'Rental'
        AND pr.related_entity_type = 'rental_bookings'
        AND pr.related_entity_id = rb.rental_booking_id
        AND pr.reference_number = CONCAT('RENTAL-CASH-', rb.booking_number)
        SET rb.payment_reference_id = pr.payment_reference_id
      WHERE rb.payment_reference_id IS NULL
        AND rb.payment_status IN ('Unpaid', 'Partially Paid')
        AND rb.booking_status IN ('Approved', 'Scheduled', 'In Use', 'Completed', 'Rescheduled')`,
  );
}
