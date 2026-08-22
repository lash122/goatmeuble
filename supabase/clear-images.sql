-- Clear all product photos (products will show without images)
UPDATE products SET photos = '{}';

-- Clear all category showcase images
UPDATE categories SET showcase_image = NULL;

-- Verify
SELECT 'Products cleared:' as info, count(*) as count FROM products WHERE photos = '{}';
SELECT 'Categories cleared:' as info, count(*) as count FROM categories WHERE showcase_image IS NULL;
