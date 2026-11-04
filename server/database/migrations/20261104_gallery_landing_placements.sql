-- Gallery and Announcement homepage photo placement. Apply once after a schema backup.
-- Existing gallery references and all original image files remain intact.
ALTER TABLE gallery_landing_slots
 ADD COLUMN source_type VARCHAR(20) NULL AFTER slot_key,
 ADD COLUMN announcement_id BIGINT UNSIGNED NULL AFTER gallery_image_id,
 ADD COLUMN announcement_image_id BIGINT UNSIGNED NULL AFTER announcement_id,
 ADD CONSTRAINT fk_gallery_slots_announcement FOREIGN KEY (announcement_id) REFERENCES announcements(announcement_id) ON UPDATE CASCADE ON DELETE SET NULL,
 ADD CONSTRAINT fk_gallery_slots_announcement_image FOREIGN KEY (announcement_image_id) REFERENCES announcement_images(announcement_image_id) ON UPDATE CASCADE ON DELETE SET NULL,
 ADD INDEX idx_gallery_slots_announcement (announcement_id),
 ADD INDEX idx_gallery_slots_announcement_image (announcement_image_id);
UPDATE gallery_landing_slots SET source_type='gallery' WHERE gallery_image_id IS NOT NULL;
CREATE TABLE gallery_landing_state (
 state_id TINYINT UNSIGNED PRIMARY KEY,
 revision BIGINT UNSIGNED NOT NULL DEFAULT 0,
 updated_by BIGINT UNSIGNED NULL,
 updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 CONSTRAINT fk_gallery_landing_state_actor FOREIGN KEY(updated_by) REFERENCES users(user_id) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;
INSERT INTO gallery_landing_state(state_id,revision) VALUES(1,0);
INSERT IGNORE INTO gallery_landing_slots(slot_key,display_order) VALUES
 ('gallery-feature-1',1),('gallery-feature-2',2),('gallery-feature-3',3),
 ('gallery-feature-4',4),('gallery-feature-5',5),('gallery-feature-6',6),('gallery-feature-7',7);
-- Give legacy featured-only announcements real references without duplicating attached photos.
INSERT INTO announcement_images(announcement_id,image_path,alt_text,sort_order,is_featured)
 SELECT a.announcement_id,a.featured_image_path,a.title,0,1 FROM announcements a
 WHERE NULLIF(TRIM(a.featured_image_path),'') IS NOT NULL
 AND NOT EXISTS(SELECT 1 FROM announcement_images i WHERE i.announcement_id=a.announcement_id);
-- No randomized selection or newly chosen image is published by this migration.
