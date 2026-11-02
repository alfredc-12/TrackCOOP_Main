-- PROPOSAL ONLY. NOT APPLIED. NOT IN server/database/migrations ON PURPOSE.
-- Pending user approval. Review, adjust, then move into migrations/ and apply to a copy of the database first.
--
-- Why: the Chairman Financial Overview classifies expense rows from a code registry because the schema cannot say whether an
-- Expense category is operating, capital or a non-expense payout, and it has no record of when or how an expense was paid.
-- Everything below is additive. Nothing here edits or deletes a financial record, and the application keeps working if none of
-- it is applied (it falls back to the registry and reports disbursement and evidence as unavailable).
--
-- Order: A (required for stored classification) -> B, C, D (optional, independent of each other).

-- ---------------------------------------------------------------------------------------------------------------
-- A. Stored expense classification on categories.  (Optional but recommended; policy must be confirmed first.)
-- ---------------------------------------------------------------------------------------------------------------
SET @trackcoop_sql = (
    SELECT IF(COUNT(*) = 0,
        'ALTER TABLE financial_categories ADD COLUMN expense_class ENUM(''operating'',''other_recognized'',''capital'',''non_expense_disbursement'') NULL AFTER category_type',
        'SELECT 1')
    FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'financial_categories' AND column_name = 'expense_class'
);
PREPARE trackcoop_stmt FROM @trackcoop_sql; EXECUTE trackcoop_stmt; DEALLOCATE PREPARE trackcoop_stmt;

-- Backfill ONLY with the classes the registry already assigns, and only where nothing is stored yet. Review this list with
-- whoever owns the cooperative's accounting policy before running it. Categories not listed stay NULL (= use the registry
-- default and show up under "Classified by default rule").
UPDATE financial_categories SET expense_class = 'operating'
 WHERE expense_class IS NULL AND category_type = 'Expense'
   AND category_code IN ('SALARIES_WAGES','FUEL_GASOLINE','UTILITIES','REPAIR_MAINTENANCE','OFFICE_SUPPLIES','SUPPLIES','INSURANCE','TRANSPORTATION','OTHER_EXPENSE');
UPDATE financial_categories SET expense_class = 'other_recognized'
 WHERE expense_class IS NULL AND category_type = 'Expense' AND category_code IN ('PRODUCT_COST');
UPDATE financial_categories SET expense_class = 'non_expense_disbursement'
 WHERE expense_class IS NULL AND category_type = 'Expense' AND category_code IN ('DIVIDEND_PAYMENT');

-- ---------------------------------------------------------------------------------------------------------------
-- B. Supporting documents linked to an expense record.  (Optional: enables evidence coverage.)
-- ---------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS financial_record_documents (
    financial_record_document_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    financial_record_id BIGINT UNSIGNED NOT NULL,
    document_id BIGINT UNSIGNED NOT NULL,
    linked_by BIGINT UNSIGNED NULL,
    linked_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_financial_record_document UNIQUE (financial_record_id, document_id),
    CONSTRAINT fk_frd_record FOREIGN KEY (financial_record_id) REFERENCES financial_records (financial_record_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_frd_document FOREIGN KEY (document_id) REFERENCES documents (document_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_frd_user FOREIGN KEY (linked_by) REFERENCES users (user_id) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------------------------------------------------
-- C. Disbursement events for an expense.  (Optional: the only thing that can support a confirmed cash-outflow figure.)
--    One expense may have several payments (installments) and a payment may be reversed; a reversal is a new row, never an edit.
-- ---------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS expense_disbursements (
    expense_disbursement_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    financial_record_id BIGINT UNSIGNED NOT NULL,
    paid_amount DECIMAL(12, 2) NOT NULL,
    paid_on DATE NOT NULL,
    payee_name VARCHAR(190) NULL,
    payment_method ENUM('Cash','Bank Transfer','Check','GCash','Other') NOT NULL,
    payment_reference VARCHAR(120) NULL,
    disbursement_status ENUM('Paid','Reversed') NOT NULL DEFAULT 'Paid',
    reverses_disbursement_id BIGINT UNSIGNED NULL,
    recorded_by BIGINT UNSIGNED NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_expense_disbursements_record (financial_record_id, paid_on),
    KEY idx_expense_disbursements_paid_on (paid_on, disbursement_status),
    CONSTRAINT chk_expense_disbursement_amount CHECK (paid_amount > 0),
    CONSTRAINT fk_ed_record FOREIGN KEY (financial_record_id) REFERENCES financial_records (financial_record_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_ed_reverses FOREIGN KEY (reverses_disbursement_id) REFERENCES expense_disbursements (expense_disbursement_id) ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_ed_user FOREIGN KEY (recorded_by) REFERENCES users (user_id) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------------------------------------------------
-- ROLLBACK (all objects are new, so removing them loses nothing that existed before):
--   DROP TABLE IF EXISTS expense_disbursements;
--   DROP TABLE IF EXISTS financial_record_documents;
--   ALTER TABLE financial_categories DROP COLUMN expense_class;
--
-- VERIFY after applying:
--   SELECT category_code, expense_class FROM financial_categories WHERE category_type = 'Expense' ORDER BY category_code;
--   SELECT COUNT(*) FROM financial_records;   -- must equal the count taken before
-- No new index on financial_records is proposed: EXPLAIN on the Overview's date-range query uses
-- idx_financial_record_date_type (record_date, record_type, record_status) already.
