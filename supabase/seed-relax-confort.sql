-- ============================================================
-- Relax Confort products — paste into Supabase SQL Editor → Run
-- Safe to re-run (uses DO blocks to skip existing products)
-- ============================================================

-- 1. Categories with showcase images
DO $$
DECLARE
  cats jsonb := '[
    {"name_fr":"Poufs & Beanbags","name_en":"Poufs & Beanbags","name_ar":"بوفات وBeanbags","image":"https://relax-confort.com/wp-content/uploads/2024/10/4.jpg"},
    {"name_fr":"Matelas","name_en":"Mattresses","name_ar":"مراتب","image":"https://relax-confort.com/wp-content/uploads/2026/01/DSCF0123-2048x2048.jpg"},
    {"name_fr":"Surmatelas","name_en":"Mattress Toppers","name_ar":"سوب مراتب","image":"https://relax-confort.com/wp-content/uploads/2026/01/DSCF0220-2048x2048.jpg"},
    {"name_fr":"Literie","name_en":"Bedding","name_ar":"ملاءات وفرش","image":"https://relax-confort.com/wp-content/uploads/2025/05/DSCF0521-2048x2048.jpg"},
    {"name_fr":"Textiles de Bain","name_en":"Bath Textiles","name_ar":"مناشف الاستحمام","image":"https://relax-confort.com/wp-content/uploads/2026/01/DSCF0393-scaled.jpg"},
    {"name_fr":"Oreillers & Coussins","name_en":"Pillows & Cushions","name_ar":"وسائد","image":"https://relax-confort.com/wp-content/uploads/2023/10/1.jpg"}
  ]'::jsonb;
  c jsonb;
  existing_id bigint;
BEGIN
  FOR c IN SELECT * FROM jsonb_array_elements(cats) LOOP
    SELECT id INTO existing_id FROM categories WHERE name_fr = c->>'name_fr' LIMIT 1;
    IF existing_id IS NULL THEN
      INSERT INTO categories (name_fr, name_en, name_ar, image) VALUES (c->>'name_fr', c->>'name_en', c->>'name_ar', c->>'image');
    ELSE
      UPDATE categories SET image = c->>'image' WHERE id = existing_id AND (image = '' OR image IS NULL);
    END IF;
  END LOOP;
END $$;

-- 2. Products
DO $$
DECLARE
  cat_poufs bigint;
  cat_matelas bigint;
  cat_surmatelas bigint;
  cat_literie bigint;
  cat_bain bigint;
  cat_oreillers bigint;
BEGIN
  SELECT id INTO cat_poufs FROM categories WHERE name_fr = 'Poufs & Beanbags' LIMIT 1;
  SELECT id INTO cat_matelas FROM categories WHERE name_fr = 'Matelas' LIMIT 1;
  SELECT id INTO cat_surmatelas FROM categories WHERE name_fr = 'Surmatelas' LIMIT 1;
  SELECT id INTO cat_literie FROM categories WHERE name_fr = 'Literie' LIMIT 1;
  SELECT id INTO cat_bain FROM categories WHERE name_fr = 'Textiles de Bain' LIMIT 1;
  SELECT id INTO cat_oreillers FROM categories WHERE name_fr = 'Oreillers & Coussins' LIMIT 1;

  -- Poire Grande
  IF NOT EXISTS (SELECT 1 FROM products WHERE name_fr = 'Poire Grande – Relaxation Orthopédique') THEN
    INSERT INTO products (name_fr, name_en, name_ar, description_fr, description_en, description_ar, price, compare_at_price, photos, sizes, category_id, featured, active, stock)
    VALUES ('Poire Grande – Relaxation Orthopédique', 'Poire Grande – Orthopedic Relaxation Beanbag', 'بوا归来 الكبرى – استرخاء عضوي',
      'La solution idéale pour un confort orthopédique inégalé. Sa structure s''adapte à votre morphologie, offrant un soutien optimal pour soulager vos douleurs dorsales.',
      'The ideal solution for unmatched orthopedic comfort. Its structure adapts to your body shape, providing optimal support to relieve back pain.',
      'الحل المثالي لراحة لا مثيل لها. يتكيف مع شكل جسمك، ليمنحك دعمًا مثاليًا لتخفيف آلام الظهر.',
      12900, 14900,
      ARRAY['https://relax-confort.com/wp-content/uploads/2026/03/1-2.jpg','https://relax-confort.com/wp-content/uploads/2022/03/1-1-800x800.jpg'],
      ARRAY['Beige','Bleu Pétrole','Gris','Jaune','Marron','Noir'],
      cat_poufs, true, true, 20);
  END IF;

  -- AURA
  IF NOT EXISTS (SELECT 1 FROM products WHERE name_fr = 'AURA – L''Éclat du Confort') THEN
    INSERT INTO products (name_fr, name_en, name_ar, description_fr, description_en, description_ar, price, compare_at_price, photos, sizes, category_id, featured, active, stock)
    VALUES ('AURA – L''Éclat du Confort', 'AURA – The Brilliance of Comfort', 'أورا – بريق الراحة',
      'L''AURA offre l''équilibre parfait entre la souplesse d''un pouf et le maintien d''un vrai fauteuil grâce à son dossier intégré et sa poche latérale.',
      'The AURA offers the perfect balance between the softness of a beanbag and the support of a real armchair with its integrated backrest.',
      'مقعد أورا يجمع بين راحة البين باج وثبات الكرسي بمسند ظهر وجيب جانبي عملي.',
      15900, 19500,
      ARRAY['https://relax-confort.com/wp-content/uploads/2026/03/DSCF0140-scaled.jpg','https://relax-confort.com/wp-content/uploads/2026/03/DSCF0205-800x800.jpg'],
      ARRAY['Beige','Bleu Pétrole','Gris','Rose','Vert'],
      cat_poufs, false, true, 20);
  END IF;

  -- Super Relax
  IF NOT EXISTS (SELECT 1 FROM products WHERE name_fr = 'Super Relax') THEN
    INSERT INTO products (name_fr, name_en, name_ar, description_fr, description_en, description_ar, price, photos, sizes, category_id, active, stock)
    VALUES ('Super Relax', 'Super Relax', 'سوبر ريلاكس',
      'Le beanbag Super Relax pour une détente maximale. Confort moelleux et design moderne.',
      'The Super Relax beanbag for maximum relaxation. Soft comfort and modern design.',
      'بوف سوبر ريلاكس لاسترخاء أقصى. راحة ناعمة وتصميم عصري.',
      11900,
      ARRAY['https://relax-confort.com/wp-content/uploads/2022/11/3.jpg','https://relax-confort.com/wp-content/uploads/2022/11/IMG_20230927_220319_002-scaled.jpg'],
      ARRAY[]::text[],
      cat_poufs, true, 20);
  END IF;

  -- Majestic
  IF NOT EXISTS (SELECT 1 FROM products WHERE name_fr = 'Majestic') THEN
    INSERT INTO products (name_fr, name_en, name_ar, description_fr, description_en, description_ar, price, photos, sizes, category_id, active, stock)
    VALUES ('Majestic', 'Majestic', 'ماجستيك',
      'Le beanbag Majestic allie luxe et confort pour une expérience de relaxation d''exception.',
      'The Majestic beanbag combines luxury and comfort for an exceptional relaxation experience.',
      'بوف ماجستيك يجمع بين الفخامة والراحة لتجربة استرخاء استثنائية.',
      14500,
      ARRAY['https://relax-confort.com/wp-content/uploads/2024/10/4.jpg','https://relax-confort.com/wp-content/uploads/2024/10/DSC09670-scaled.jpg'],
      ARRAY[]::text[],
      cat_poufs, true, 20);
  END IF;

  -- Matelas NIRVANA
  IF NOT EXISTS (SELECT 1 FROM products WHERE name_fr = 'Matelas NIRVANA – Mousse D30') THEN
    INSERT INTO products (name_fr, name_en, name_ar, description_fr, description_en, description_ar, price, photos, sizes, category_id, featured, active, stock)
    VALUES ('Matelas NIRVANA – Mousse D30', 'NIRVANA Mattress – D30 Foam', 'مراتب نيرفانا – رغوة كثافة 30',
      'L''alliance parfaite entre soutien orthopédique ferme (mousse D30) et accueil moelleux. Respirant, hypoallergénique et garanti 10 ans. 🎁 1 à 2 oreillers offerts!',
      'The perfect blend of firm orthopedic support (D30 foam) and soft comfort. Breathable, hypoallergenic, 10-year warranty. 🎁 1 to 2 free pillows!',
      'المزيج المثالي بين الدعم الطبي الصلب والملمس الناعم. مضادة للحساسية ومضمونة 10 سنوات.',
      16900,
      ARRAY['https://relax-confort.com/wp-content/uploads/2024/05/DSCF0228-scaled.jpg','https://relax-confort.com/wp-content/uploads/2026/01/21-800x800.jpg'],
      ARRAY['90x190','100x190','120x190','140x190','160x200','180x200'],
      cat_matelas, true, true, 15);
  END IF;

  -- Surmatelas SUKOON D30
  IF NOT EXISTS (SELECT 1 FROM products WHERE name_fr = 'Surmatelas SUKOON D30') THEN
    INSERT INTO products (name_fr, name_en, name_ar, description_fr, description_en, description_ar, price, photos, sizes, category_id, active, stock)
    VALUES ('Surmatelas SUKOON D30', 'SUKOON D30 Mattress Topper', 'سوب ماتلا سوكون دي 30',
      'Soutien stable grâce à la mousse haute densité D30. Couche de fibre siliconée pour un accueil doux. 🎁 1 à 2 oreillers offerts!',
      'Stable support thanks to D30 high-density foam. Silicone fiber layer for a soft feel. 🎁 1 to 2 free pillows!',
      'دعم ثابت بفضل الرغوة عالية الكثافة. طبقة ألياف سيليكونية للراحة.',
      7900,
      ARRAY['https://relax-confort.com/wp-content/uploads/2026/01/DSCF0220-1-scaled.jpg','https://relax-confort.com/wp-content/uploads/2026/01/19-800x800.jpg'],
      ARRAY['90x190','100x190','120x190','140x190','160x200'],
      cat_surmatelas, true, 20);
  END IF;

  -- Surmatelas SUKOON Visco
  IF NOT EXISTS (SELECT 1 FROM products WHERE name_fr = 'Surmatelas SUKOON Visco') THEN
    INSERT INTO products (name_fr, name_en, name_ar, description_fr, description_en, description_ar, price, photos, sizes, category_id, active, stock)
    VALUES ('Surmatelas SUKOON Visco', 'SUKOON Visco Mattress Topper', 'سوب ماتلا سوكون فيسكو',
      'Mousse à mémoire de forme viscoélastique pour un soutien sur mesure. S''adapte parfaitement à la forme du corps.',
      'Viscoelastic memory foam for customized support. Perfectly adapts to body shape.',
      'رغوة ميموري فوم لدعم مخصص. يتكيف بشكل مثالي مع شكل الجسم.',
      9500,
      ARRAY['https://relax-confort.com/wp-content/uploads/2026/01/DSCF0174-scaled.jpg','https://relax-confort.com/wp-content/uploads/2026/01/18.jpg'],
      ARRAY['90x190','100x190','120x190','140x190'],
      cat_surmatelas, true, 20);
  END IF;

  -- Bloomé
  IF NOT EXISTS (SELECT 1 FROM products WHERE name_fr = 'Bloomé – Parure de Draps Fleurie') THEN
    INSERT INTO products (name_fr, name_en, name_ar, description_fr, description_en, description_ar, price, photos, sizes, category_id, active, stock)
    VALUES ('Bloomé – Parure de Draps Fleurie', 'Bloomé – Floral Sheet Set', 'بلومي – طقم ملاءات زهري',
      'Parure en coton haut de gamme, douceur et motif fleuri élégant. 1 place ou 2 places disponible.',
      'Premium cotton set combining softness with elegant floral pattern. Single or double available.',
      'طقم من القطن الفاخر يجمع بين النعومة والتصميم الزهري الأنيق.',
      6900,
      ARRAY['https://relax-confort.com/wp-content/uploads/2025/08/1-1.jpg','https://relax-confort.com/wp-content/uploads/2025/08/3-800x800.jpg'],
      ARRAY['1 Place','2 Places'],
      cat_literie, true, 20);
  END IF;

  -- Parure Sérénité
  IF NOT EXISTS (SELECT 1 FROM products WHERE name_fr = 'Parure de Draps Sérénité') THEN
    INSERT INTO products (name_fr, name_en, name_ar, description_fr, description_en, description_ar, price, photos, sizes, category_id, active, stock)
    VALUES ('Parure de Draps Sérénité', 'Serenity Sheet Set', 'طقم ملاءات سيرينيتي',
      'Parure de draps en coton pour un sommeil serein. Finition soignée et tissu respirant.',
      'Cotton sheet set for peaceful sleep. Carefully finished and breathable fabric.',
      'طقم ملاءات من القطن لنوم هادئ. خياطة دقيقة وقماش قابل للتهوية.',
      5500,
      ARRAY['https://relax-confort.com/wp-content/uploads/2025/05/DSCF0517-scaled.jpg','https://relax-confort.com/wp-content/uploads/2025/05/DSCF0419-scaled.jpg'],
      ARRAY['1 Place','2 Places'],
      cat_literie, true, 20);
  END IF;

  -- ELVA
  IF NOT EXISTS (SELECT 1 FROM products WHERE name_fr = 'Ensemble Sortie de Bain ELVA') THEN
    INSERT INTO products (name_fr, name_en, name_ar, description_fr, description_en, description_ar, price, photos, sizes, category_id, active, stock)
    VALUES ('Ensemble Sortie de Bain ELVA', 'ELVA Bath Outfit Set', 'طقم مناشف الإسبان إلفا',
      'Confort optimal après chaque bain en coton absorbant de qualité.',
      'Optimal comfort after every bath with quality absorbent cotton.',
      'راحة مثالية بعد كل استحمام مع قطن عالي الامتصاص.',
      7500,
      ARRAY['https://relax-confort.com/wp-content/uploads/2026/01/DSCF0393-scaled.jpg','https://relax-confort.com/wp-content/uploads/2026/01/2-1.jpg'],
      ARRAY['Simple','Couple'],
      cat_bain, true, 20);
  END IF;

  -- Couette Softy
  IF NOT EXISTS (SELECT 1 FROM products WHERE name_fr = 'Couette Softy') THEN
    INSERT INTO products (name_fr, name_en, name_ar, description_fr, description_en, description_ar, price, photos, sizes, category_id, active, stock)
    VALUES ('Couette Softy', 'Softy Duvet', 'كوويت سوفتي',
      'Couette ultra-douce pour des nuits chaudes et confortables. Matériau hypoallergénique.',
      'Ultra-soft duvet for warm and comfortable nights. Hypoallergenic material.',
      'كوويت ناعمة للغاية لليالي الدافئة. مواد مضادة للحساسية.',
      4900,
      ARRAY['https://relax-confort.com/wp-content/uploads/2025/05/DSCF0285-scaled.jpg'],
      ARRAY['1 Place','2 Places'],
      cat_oreillers, true, 20);
  END IF;

  -- Oreiller Seline
  IF NOT EXISTS (SELECT 1 FROM products WHERE name_fr = 'Oreiller Seline') THEN
    INSERT INTO products (name_fr, name_en, name_ar, description_fr, description_en, description_ar, price, photos, sizes, category_id, active, stock)
    VALUES ('Oreiller Seline', 'Seline Pillow', 'وسادة سيلين',
      'Oreiller ergonomique pour un soutien optimal de la tête et du cou. Mousse à mémoire de forme.',
      'Ergonomic pillow for optimal head and neck support. Memory foam.',
      'وسادة مريحة لراحة مثالية للرأس والرقبة. رغوة ميموري فوم.',
      3500,
      ARRAY['https://relax-confort.com/wp-content/uploads/2026/03/Oreiller-Seline.jpg','https://relax-confort.com/wp-content/uploads/2026/03/4.jpg'],
      ARRAY[]::text[],
      cat_oreillers, true, 20);
  END IF;

END $$;

-- Verify
SELECT count(*) as total_products FROM products WHERE active = true;
SELECT name_fr, price, featured FROM products WHERE active = true ORDER BY created_at;
