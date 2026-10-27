-- Seasonal analytics and budget controls.
-- Existing financial and POS records remain valid; nullable season links keep
-- historical records available while the cooperative assigns them gradually.

CREATE TABLE IF NOT EXISTS seasons (
    season_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    season_name VARCHAR(120) NOT NULL,
    season_type VARCHAR(80) NOT NULL,
    season_year SMALLINT UNSIGNED NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    season_status ENUM('Draft', 'Active', 'Closed') NOT NULL DEFAULT 'Draft',
    description TEXT NULL,
    created_by BIGINT UNSIGNED NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_seasons_name_year UNIQUE (season_name, season_year),
    CONSTRAINT fk_seasons_created_by FOREIGN KEY (created_by) REFERENCES users (user_id) ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT chk_seasons_date_range CHECK (end_date >= start_date)
) ENGINE = InnoDB;

CREATE INDEX idx_seasons_status_dates ON seasons (season_status, start_date, end_date);

CREATE TABLE IF NOT EXISTS production_records (
    production_record_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    season_id BIGINT UNSIGNED NOT NULL,
    member_id BIGINT UNSIGNED NULL,
    barangay VARCHAR(120) NULL,
    sector VARCHAR(120) NOT NULL,
    crop_name VARCHAR(160) NOT NULL,
    area_planted DECIMAL(14, 3) NULL,
    area_unit VARCHAR(40) NULL,
    quantity_produced DECIMAL(14, 3) NOT NULL,
    quantity_unit VARCHAR(40) NOT NULL DEFAULT 'kg',
    production_cost DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
    harvest_date DATE NULL,
    production_status ENUM('Draft', 'Recorded', 'Verified', 'Harvested', 'Cancelled') NOT NULL DEFAULT 'Recorded',
    remarks TEXT NULL,
    recorded_by BIGINT UNSIGNED NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_production_season FOREIGN KEY (season_id) REFERENCES seasons (season_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_production_member FOREIGN KEY (member_id) REFERENCES member_profiles (member_id) ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_production_recorded_by FOREIGN KEY (recorded_by) REFERENCES users (user_id) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE = InnoDB;

CREATE INDEX idx_production_season_status ON production_records (season_id, production_status, harvest_date);
CREATE INDEX idx_production_crop ON production_records (crop_name, sector);
CREATE INDEX idx_production_member ON production_records (member_id, season_id);

CREATE TABLE IF NOT EXISTS budgets (
    budget_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    budget_name VARCHAR(160) NOT NULL,
    coverage_start DATE NOT NULL,
    coverage_end DATE NOT NULL,
    budget_status ENUM('Draft', 'Pending Approval', 'Approved', 'Closed') NOT NULL DEFAULT 'Draft',
    notes TEXT NULL,
    created_by BIGINT UNSIGNED NOT NULL,
    approved_by BIGINT UNSIGNED NULL,
    approved_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT chk_budgets_date_range CHECK (coverage_end >= coverage_start),
    CONSTRAINT fk_budgets_created_by FOREIGN KEY (created_by) REFERENCES users (user_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_budgets_approved_by FOREIGN KEY (approved_by) REFERENCES users (user_id) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE = InnoDB;

CREATE INDEX idx_budgets_status_dates ON budgets (budget_status, coverage_start, coverage_end);

CREATE TABLE IF NOT EXISTS budget_lines (
    budget_line_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    budget_id BIGINT UNSIGNED NOT NULL,
    financial_category_id SMALLINT UNSIGNED NOT NULL,
    season_id BIGINT UNSIGNED NULL,
    limit_amount DECIMAL(14, 2) NOT NULL,
    warning_percentage DECIMAL(5, 2) NOT NULL DEFAULT 80.00,
    hard_limit TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_budget_line_category_scope UNIQUE (budget_id, financial_category_id, season_id),
    CONSTRAINT fk_budget_lines_budget FOREIGN KEY (budget_id) REFERENCES budgets (budget_id) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_budget_lines_category FOREIGN KEY (financial_category_id) REFERENCES financial_categories (financial_category_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_budget_lines_season FOREIGN KEY (season_id) REFERENCES seasons (season_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT chk_budget_line_amount CHECK (limit_amount >= 0),
    CONSTRAINT chk_budget_line_warning CHECK (warning_percentage > 0 AND warning_percentage <= 100)
) ENGINE = InnoDB;

CREATE INDEX idx_budget_lines_category ON budget_lines (financial_category_id, season_id);

SET @trackcoop_sql = (
    SELECT IF(
        COUNT(*) = 0,
        'ALTER TABLE financial_records ADD COLUMN season_id BIGINT UNSIGNED NULL, ADD INDEX idx_financial_record_season (season_id, record_date)',
        'SELECT 1'
    )
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'financial_records'
      AND column_name = 'season_id'
);
PREPARE trackcoop_stmt FROM @trackcoop_sql;
EXECUTE trackcoop_stmt;
DEALLOCATE PREPARE trackcoop_stmt;

SET @trackcoop_sql = (
    SELECT IF(
        COUNT(*) = 0,
        'ALTER TABLE pos_sales ADD COLUMN season_id BIGINT UNSIGNED NULL, ADD INDEX idx_pos_sales_season (season_id, sale_date)',
        'SELECT 1'
    )
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'pos_sales'
      AND column_name = 'season_id'
);
PREPARE trackcoop_stmt FROM @trackcoop_sql;
EXECUTE trackcoop_stmt;
DEALLOCATE PREPARE trackcoop_stmt;
