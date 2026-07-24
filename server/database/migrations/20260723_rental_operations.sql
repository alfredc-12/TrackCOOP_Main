-- Additive TrackCOOP rental operations tables.
-- This migration preserves all rental_assets and rental_bookings records.

CREATE TABLE IF NOT EXISTS rental_maintenance_periods (
    rental_maintenance_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    rental_asset_id BIGINT UNSIGNED NOT NULL,
    maintenance_type VARCHAR(120) NOT NULL,
    start_datetime DATETIME NOT NULL,
    end_datetime DATETIME NOT NULL,
    description TEXT NOT NULL,
    technician_provider VARCHAR(190) NULL,
    cost DECIMAL(12,2) NULL,
    internal_note TEXT NULL,
    operational_impact ENUM('Limited Availability', 'Unavailable', 'Out of Service')
        NOT NULL DEFAULT 'Unavailable',
    maintenance_status ENUM('Scheduled', 'In Progress', 'Completed', 'Cancelled')
        NOT NULL DEFAULT 'Scheduled',
    created_by BIGINT UNSIGNED NOT NULL,
    completed_by BIGINT UNSIGNED NULL,
    completed_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_rental_maintenance_asset_period
        (rental_asset_id, start_datetime, end_datetime, maintenance_status),
    CONSTRAINT fk_rental_maintenance_asset
        FOREIGN KEY (rental_asset_id) REFERENCES rental_assets(rental_asset_id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_rental_maintenance_creator
        FOREIGN KEY (created_by) REFERENCES users(user_id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_rental_maintenance_completer
        FOREIGN KEY (completed_by) REFERENCES users(user_id)
        ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS rental_idempotency_keys (
    idempotency_key VARCHAR(120) PRIMARY KEY,
    operation VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NULL,
    entity_id BIGINT UNSIGNED NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NULL,
    INDEX idx_rental_idempotency_entity (entity_type, entity_id),
    INDEX idx_rental_idempotency_expiry (expires_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS rental_booking_sequences (
    reference_year SMALLINT UNSIGNED PRIMARY KEY,
    last_number INT UNSIGNED NOT NULL DEFAULT 0,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

INSERT INTO rental_booking_sequences (reference_year, last_number)
SELECT
    YEAR(CURDATE()),
    COALESCE(
        MAX(
            CASE
                WHEN booking_number REGEXP CONCAT('^RNT-', YEAR(CURDATE()), '-[0-9]+$')
                THEN CAST(SUBSTRING_INDEX(booking_number, '-', -1) AS UNSIGNED)
                ELSE 0
            END
        ),
        0
    )
FROM rental_bookings
ON DUPLICATE KEY UPDATE
    last_number = GREATEST(last_number, VALUES(last_number));
