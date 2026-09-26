UPDATE products
SET image_path = CONCAT('/uploads/inventory/', SUBSTRING_INDEX(image_path, '/', -1))
WHERE image_path LIKE '/images/products/%'
   OR image_path LIKE 'images/products/%';
