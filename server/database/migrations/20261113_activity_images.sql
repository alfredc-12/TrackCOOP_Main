-- Store one optional event image and reuse it as the featured image of the
-- member-facing event announcement.
ALTER TABLE cooperative_activities
  ADD COLUMN image_path VARCHAR(1000) NULL AFTER description;
