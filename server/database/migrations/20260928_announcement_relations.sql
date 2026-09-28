-- ============================================================================
-- TrackCOOP online migration: announcement images and audience targets
-- Run this on an existing database before deploying the current announcements
-- API. It preserves all existing announcements and recipient records.
-- ============================================================================

SET NAMES utf8mb4;
SET time_zone = '+08:00';

CREATE TABLE IF NOT EXISTS announcement_audience_targets (
    announcement_target_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    announcement_id BIGINT UNSIGNED NOT NULL,
    target_type ENUM(
        'Barangay',
        'Sector'
    ) NOT NULL,
    target_value VARCHAR(190) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_announcement_target UNIQUE (
        announcement_id,
        target_type,
        target_value
    ),
    CONSTRAINT fk_announcement_targets_announcement FOREIGN KEY (announcement_id) REFERENCES announcements (announcement_id) ON UPDATE CASCADE ON DELETE CASCADE,
    INDEX idx_announcement_targets_lookup (
        target_type,
        target_value,
        announcement_id
    ),
    INDEX idx_announcement_targets_announcement (
        announcement_id,
        target_type
    )
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS announcement_images (
    announcement_image_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    announcement_id BIGINT UNSIGNED NOT NULL,
    image_path VARCHAR(500) NOT NULL,
    alt_text VARCHAR(255) NULL,
    sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    is_featured TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_announcement_image_path UNIQUE (announcement_id, image_path),
    CONSTRAINT fk_announcement_images_announcement FOREIGN KEY (announcement_id) REFERENCES announcements (announcement_id) ON UPDATE CASCADE ON DELETE CASCADE,
    INDEX idx_announcement_images_order (
        announcement_id,
        sort_order,
        announcement_image_id
    )
) ENGINE = InnoDB;
