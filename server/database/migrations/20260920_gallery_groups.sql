-- ============================================================================
-- TrackCOOP online migration: grouped gallery records
-- Run this on the existing online database before switching the Gallery UI/API.
-- Existing gallery_items rows are copied into one-photo gallery groups.
-- ============================================================================

SET NAMES utf8mb4;
SET time_zone = '+08:00';

CREATE TABLE IF NOT EXISTS gallery_groups (
    gallery_group_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    caption TEXT NULL,
    category VARCHAR(120) NULL,
    activity_date DATE NULL,
    location VARCHAR(255) NULL,
    border_color VARCHAR(20) NULL,
    public_visibility TINYINT(1) NOT NULL DEFAULT 1,
    gallery_status ENUM(
        'Draft',
        'Published',
        'Archived'
    ) NOT NULL DEFAULT 'Draft',
    display_order INT NOT NULL DEFAULT 0,
    uploaded_by BIGINT UNSIGNED NOT NULL,
    published_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_gallery_groups_uploader FOREIGN KEY (uploaded_by) REFERENCES users (user_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    INDEX idx_gallery_groups_public (
        gallery_status,
        public_visibility,
        activity_date,
        display_order
    ),
    INDEX idx_gallery_groups_created (
        created_at,
        display_order
    )
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS gallery_images (
    gallery_image_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    gallery_group_id BIGINT UNSIGNED NOT NULL,
    image_path VARCHAR(500) NOT NULL,
    thumbnail_path VARCHAR(500) NULL,
    alt_text VARCHAR(255) NULL,
    sort_order INT NOT NULL DEFAULT 0,
    is_cover TINYINT(1) NOT NULL DEFAULT 0,
    public_visibility TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_gallery_images_group FOREIGN KEY (gallery_group_id) REFERENCES gallery_groups (gallery_group_id) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT uq_gallery_images_path UNIQUE (gallery_group_id, image_path),
    INDEX idx_gallery_images_order (
        gallery_group_id,
        sort_order,
        gallery_image_id
    ),
    INDEX idx_gallery_images_cover (
        gallery_group_id,
        is_cover
    )
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS gallery_landing_slots (
    slot_key VARCHAR(80) PRIMARY KEY,
    gallery_group_id BIGINT UNSIGNED NULL,
    gallery_image_id BIGINT UNSIGNED NULL,
    display_order INT NOT NULL DEFAULT 0,
    updated_by BIGINT UNSIGNED NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_gallery_landing_slots_group FOREIGN KEY (gallery_group_id) REFERENCES gallery_groups (gallery_group_id) ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_gallery_landing_slots_image FOREIGN KEY (gallery_image_id) REFERENCES gallery_images (gallery_image_id) ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_gallery_landing_slots_updated_by FOREIGN KEY (updated_by) REFERENCES users (user_id) ON UPDATE CASCADE ON DELETE SET NULL,
    INDEX idx_gallery_landing_slots_group (gallery_group_id),
    INDEX idx_gallery_landing_slots_image (gallery_image_id)
) ENGINE = InnoDB;

INSERT IGNORE INTO gallery_groups (
    gallery_group_id,
    title,
    caption,
    category,
    activity_date,
    location,
    border_color,
    public_visibility,
    gallery_status,
    display_order,
    uploaded_by,
    published_at,
    created_at,
    updated_at
)
SELECT
    gallery_item_id,
    title,
    caption,
    category,
    activity_date,
    location,
    '#D8B04C',
    public_visibility,
    gallery_status,
    display_order,
    uploaded_by,
    published_at,
    created_at,
    updated_at
FROM gallery_items;

INSERT IGNORE INTO gallery_images (
    gallery_group_id,
    image_path,
    thumbnail_path,
    alt_text,
    sort_order,
    is_cover,
    public_visibility,
    created_at,
    updated_at
)
SELECT
    gallery_item_id,
    image_path,
    thumbnail_path,
    alt_text,
    1,
    1,
    public_visibility,
    created_at,
    updated_at
FROM gallery_items;

-- Keep gallery_items until the backend and UI are fully switched to the grouped
-- gallery tables. After that deploy, you can run:
-- DROP TABLE gallery_items;
