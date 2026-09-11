-- ============================================================
-- ANAOKULU YEMEKHANE STOK TAKİP SİSTEMİ
-- Başlangıç (Seed) Verileri — PostgreSQL / Supabase
-- 3 Öğünlü Sistem: Kahvaltı, Öğle Yemeği, İkindi Kahvaltısı
-- ============================================================

-- ──────────────────────────────────────────────
-- TEDARİKÇİLER
-- ──────────────────────────────────────────────
INSERT INTO suppliers (name, phone, notes) VALUES
  ('Özlem Toptan Gıda',   '0212 555 0101', 'Kuru gıda ve bakliyat tedarikçisi — Çarşamba teslimat'),
  ('Yeşil Vadi Manavı',   '0212 555 0102', 'Günlük taze sebze ve meyve — Sabah 07:30 teslimat'),
  ('Bereket Et & Tavuk',  '0212 555 0103', 'Helal kesim dana kıyma ve taze tavuk'),
  ('Sütsan Mandıra',      '0212 555 0104', 'Günlük pastörize süt, tereyağı ve beyaz peynir')
ON CONFLICT DO NOTHING;

-- ──────────────────────────────────────────────
-- ÜRÜNLER (protein_per_unit: 1 birim başına gram protein)
-- ──────────────────────────────────────────────
INSERT INTO products (id, name, unit, category, critical_threshold, protein_per_unit) VALUES
  -- Tahıl & Bakliyat
  ( 1, 'Pirinç',              'kg',    'tahıl',        5.00,  7.1),
  ( 2, 'Bulgur (ince)',       'kg',    'tahıl',        5.00, 12.3),
  ( 3, 'Kırmızı Mercimek',    'kg',    'bakliyat',     3.00, 24.6),
  ( 4, 'Nohut',               'kg',    'bakliyat',     3.00, 19.3),
  -- Et & Tavuk
  ( 5, 'Kıyma (dana)',        'kg',    'et',           4.00, 26.1),
  ( 6, 'Tavuk But',           'kg',    'et',           4.00, 27.4),
  ( 7, 'Tavuk Göğüs',         'kg',    'et',           3.00, 31.0),
  -- Sebze & Meyve
  ( 8, 'Patates',             'kg',    'sebze',        5.00,  2.0),
  ( 9, 'Soğan',               'kg',    'sebze',        3.00,  1.1),
  (10, 'Domates',             'kg',    'sebze',        2.00,  0.9),
  (11, 'Biber (kapya)',       'kg',    'sebze',        2.00,  1.0),
  (12, 'Ispanak',             'kg',    'sebze',        2.00,  2.9),
  (13, 'Havuç',               'kg',    'sebze',        2.00,  0.9),
  (14, 'Fasulye (taze)',      'kg',    'sebze',        2.00,  1.8),
  (25, 'Elma',                'kg',    'meyve',        3.00,  0.3),
  -- Süt Ürünleri & Kahvaltılık
  (15, 'Süt',                 'litre', 'süt ürünleri', 10.00,  3.4),
  (16, 'Tereyağı',            'kg',    'süt ürünleri',  1.00,  0.9),
  (21, 'Yumurta',             'adet',  'kahvaltılık',  30.00,  6.3),
  (22, 'Beyaz Peynir',        'kg',    'süt ürünleri',  2.00, 18.0),
  (23, 'Siyah Zeytin',        'kg',    'kahvaltılık',   1.50,  0.8),
  (24, 'Yulaf Ezmesi',        'kg',    'tahıl',         2.00, 13.5),
  -- Yağ & Salça & Baharat
  (17, 'Sıvı Yağ (ayçiçek)', 'litre', 'yağ',           3.00,  0.0),
  (18, 'Domates Salçası',     'kg',    'salça',         2.00,  4.8),
  (19, 'Tuz',                 'kg',    'baharat',       1.00,  0.0),
  (20, 'Un',                  'kg',    'tahıl',         3.00, 10.3)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name, unit = EXCLUDED.unit, category = EXCLUDED.category,
    critical_threshold = EXCLUDED.critical_threshold, protein_per_unit = EXCLUDED.protein_per_unit;

SELECT setval(pg_get_serial_sequence('products', 'id'), COALESCE(MAX(id), 1)) FROM products;

-- ──────────────────────────────────────────────
-- REÇETELER (Kahvaltı, Öğle, İkindi)
-- ──────────────────────────────────────────────
INSERT INTO recipes (id, meal_name, meal_type) VALUES
  -- Öğle Yemekleri (1 - 7)
  ( 1, 'Kuru Fasulye',              'ogle'),
  ( 2, 'Mercimek Çorbası',          'ogle'),
  ( 3, 'Tavuk Sote',                'ogle'),
  ( 4, 'Nohutlu Pilav',             'ogle'),
  ( 5, 'Ispanak Yemeği',            'ogle'),
  ( 6, 'Patates Haşlama',           'ogle'),
  ( 7, 'Bulgur Pilavı',             'ogle'),
  -- Kahvaltılar (8 - 12)
  ( 8, 'Peynirli Klasik Kahvaltı',  'kahvalti'),
  ( 9, 'Sütlü Yulaf Lapası & Meyve', 'kahvalti'),
  (10, 'Menemen & Ekmek',           'kahvalti'),
  (11, 'Krep / Pankek & Süt',       'kahvalti'),
  (12, 'Haşlanmış Yumurta & Peynir','kahvalti'),
  -- İkindi Kahvaltıları (13 - 17)
  (13, 'Havuçlu Anne Keki & Süt',   'ikindi'),
  (14, 'Ev Yapımı Peynirli Poğaça', 'ikindi'),
  (15, 'Süt & Taze Elma Dilimleri', 'ikindi'),
  (16, 'Peynirli Mini Sandviç',     'ikindi'),
  (17, 'Meyveli Yoğurt & Yulaf',    'ikindi')
ON CONFLICT (id) DO UPDATE
SET meal_name = EXCLUDED.meal_name, meal_type = EXCLUDED.meal_type;

SELECT setval(pg_get_serial_sequence('recipes', 'id'), COALESCE(MAX(id), 1)) FROM recipes;

-- ──────────────────────────────────────────────
-- REÇETE İÇERİKLERİ (1 Çocuk Porsiyonu İçin)
-- ──────────────────────────────────────────────
DELETE FROM recipe_ingredients;

INSERT INTO recipe_ingredients (recipe_id, product_id, quantity_per_portion) VALUES
  -- 1. Kuru Fasulye (Öğle)
  (1, 14, 0.0800),  -- Fasulye 80 g
  (1,  9, 0.0200),  -- Soğan 20 g
  (1, 18, 0.0100),  -- Salça 10 g
  (1, 17, 0.0100),  -- Sıvı Yağ 10 ml
  (1, 19, 0.0020),  -- Tuz 2 g

  -- 2. Mercimek Çorbası (Öğle)
  (2,  3, 0.0600),  -- Mercimek 60 g
  (2,  9, 0.0150),  -- Soğan 15 g
  (2, 13, 0.0200),  -- Havuç 20 g
  (2, 17, 0.0080),  -- Sıvı Yağ 8 ml
  (2, 19, 0.0020),  -- Tuz 2 g

  -- 3. Tavuk Sote (Öğle)
  (3,  7, 0.1200),  -- Tavuk Göğüs 120 g
  (3,  9, 0.0200),  -- Soğan 20 g
  (3, 11, 0.0300),  -- Biber 30 g
  (3, 10, 0.0300),  -- Domates 30 g
  (3, 17, 0.0100),  -- Sıvı Yağ 10 ml
  (3, 19, 0.0020),  -- Tuz 2 g

  -- 4. Nohutlu Pilav (Öğle)
  (4,  1, 0.0800),  -- Pirinç 80 g
  (4,  4, 0.0400),  -- Nohut 40 g
  (4, 16, 0.0050),  -- Tereyağı 5 g
  (4, 19, 0.0020),  -- Tuz 2 g

  -- 5. Ispanak Yemeği (Öğle)
  (5, 12, 0.1500),  -- Ispanak 150 g
  (5,  5, 0.0500),  -- Kıyma 50 g
  (5,  9, 0.0150),  -- Soğan 15 g
  (5, 17, 0.0080),  -- Sıvı Yağ 8 ml
  (5, 19, 0.0020),  -- Tuz 2 g

  -- 6. Patates Haşlama (Yan Yemek)
  (6,  8, 0.1500),  -- Patates 150 g
  (6, 19, 0.0020),  -- Tuz 2 g

  -- 7. Bulgur Pilavı (Yan Yemek)
  (7,  2, 0.0800),  -- Bulgur 80 g
  (7, 16, 0.0050),  -- Tereyağı 5 g
  (7, 19, 0.0020),  -- Tuz 2 g

  -- 8. Peynirli Klasik Kahvaltı
  (8, 21, 1.0000),  -- Yumurta 1 adet
  (8, 22, 0.0300),  -- Beyaz Peynir 30 g
  (8, 23, 0.0200),  -- Siyah Zeytin 20 g
  (8, 10, 0.0300),  -- Domates 30 g
  (8, 15, 0.1500),  -- Süt 150 ml

  -- 9. Sütlü Yulaf Lapası & Meyve
  (9, 24, 0.0400),  -- Yulaf 40 g
  (9, 15, 0.1500),  -- Süt 150 ml
  (9, 16, 0.0050),  -- Tereyağı 5 g
  (9, 25, 0.0500),  -- Elma 50 g

  -- 10. Menemen & Ekmek
  (10, 21, 1.0000), -- Yumurta 1 adet
  (10, 10, 0.0600), -- Domates 60 g
  (10, 11, 0.0200), -- Biber 20 g
  (10, 16, 0.0050), -- Tereyağı 5 g
  (10, 19, 0.0010), -- Tuz 1 g

  -- 11. Krep / Pankek & Süt
  (11, 20, 0.0400), -- Un 40 g
  (11, 15, 0.1500), -- Süt 150 ml
  (11, 21, 0.5000), -- Yumurta 0.5 adet
  (11, 16, 0.0050), -- Tereyağı 5 g

  -- 12. Haşlanmış Yumurta & Peynir (Cuma Kahvaltısı)
  (12, 21, 1.0000), -- Yumurta 1 adet
  (12, 22, 0.0400), -- Beyaz Peynir 40 g
  (12, 23, 0.0200), -- Siyah Zeytin 20 g
  (12, 15, 0.1500), -- Süt 150 ml

  -- 13. Havuçlu Anne Keki & Süt
  (13, 20, 0.0350), -- Un 35 g
  (13, 13, 0.0250), -- Havuç 25 g
  (13, 15, 0.1500), -- Süt 150 ml
  (13, 17, 0.0060), -- Sıvı Yağ 6 ml
  (13, 21, 0.3000), -- Yumurta 0.3 adet

  -- 14. Ev Yapımı Peynirli Poğaça
  (14, 20, 0.0400), -- Un 40 g
  (14, 22, 0.0200), -- Beyaz Peynir 20 g
  (14, 16, 0.0080), -- Tereyağı 8 g
  (14, 15, 0.1000), -- Süt 100 ml
  (14, 19, 0.0010), -- Tuz 1 g

  -- 15. Süt & Taze Elma Dilimleri
  (15, 15, 0.1500), -- Süt 150 ml
  (15, 25, 0.1000), -- Elma 100 g

  -- 16. Peynirli Mini Sandviç
  (16, 20, 0.0400), -- Un 40 g
  (16, 22, 0.0250), -- Beyaz Peynir 25 g
  (16, 10, 0.0200), -- Domates 20 g
  (16, 16, 0.0050), -- Tereyağı 5 g

  -- 17. Meyveli Yoğurt & Yulaf (Cuma İkindisi)
  (17, 15, 0.1500), -- Süt 150 ml
  (17, 25, 0.0600), -- Elma 60 g
  (17, 24, 0.0250); -- Yulaf 25 g

-- ──────────────────────────────────────────────
-- HAFTALIK MENÜ (Günde 3 Öğün: 5 Gün x 3 Öğün = 15 Kayıt)
-- ──────────────────────────────────────────────
DELETE FROM weekly_menu;

INSERT INTO weekly_menu (day_of_week, recipe_id, meal_type, valid_from) VALUES
  -- Pazartesi (1)
  (1,  8, 'kahvalti', '2026-01-01'), -- Peynirli Klasik Kahvaltı
  (1,  1, 'ogle',     '2026-01-01'), -- Kuru Fasulye
  (1, 13, 'ikindi',   '2026-01-01'), -- Havuçlu Anne Keki & Süt

  -- Salı (2)
  (2,  9, 'kahvalti', '2026-01-01'), -- Sütlü Yulaf Lapası & Meyve
  (2,  2, 'ogle',     '2026-01-01'), -- Mercimek Çorbası
  (2, 14, 'ikindi',   '2026-01-01'), -- Ev Yapımı Peynirli Poğaça

  -- Çarşamba (3)
  (3, 10, 'kahvalti', '2026-01-01'), -- Menemen & Ekmek
  (3,  3, 'ogle',     '2026-01-01'), -- Tavuk Sote
  (3, 15, 'ikindi',   '2026-01-01'), -- Süt & Taze Elma Dilimleri

  -- Perşembe (4)
  (4, 11, 'kahvalti', '2026-01-01'), -- Krep / Pankek & Süt
  (4,  4, 'ogle',     '2026-01-01'), -- Nohutlu Pilav
  (4, 16, 'ikindi',   '2026-01-01'), -- Peynirli Mini Sandviç

  -- Cuma (5)
  (5, 12, 'kahvalti', '2026-01-01'), -- Haşlanmış Yumurta & Peynir
  (5,  5, 'ogle',     '2026-01-01'), -- Ispanak Yemeği
  (5, 17, 'ikindi',   '2026-01-01'); -- Meyveli Yoğurt & Yulaf

-- ──────────────────────────────────────────────
-- BAŞLANGIÇ STOĞU (Tüm Ürünler İçin)
-- ──────────────────────────────────────────────
INSERT INTO stock_transactions (product_id, transaction_type, quantity, source_type, transaction_date) VALUES
  ( 1, 'in',  25.000, 'manual', CURRENT_DATE), -- Pirinç         25 kg
  ( 2, 'in',  20.000, 'manual', CURRENT_DATE), -- Bulgur         20 kg
  ( 3, 'in',  15.000, 'manual', CURRENT_DATE), -- Mercimek       15 kg
  ( 4, 'in',  10.000, 'manual', CURRENT_DATE), -- Nohut          10 kg
  ( 5, 'in',  12.000, 'manual', CURRENT_DATE), -- Kıyma          12 kg
  ( 6, 'in',  15.000, 'manual', CURRENT_DATE), -- Tavuk But      15 kg
  ( 7, 'in',  18.000, 'manual', CURRENT_DATE), -- Tavuk Göğüs   18 kg
  ( 8, 'in',  40.000, 'manual', CURRENT_DATE), -- Patates        40 kg
  ( 9, 'in',  10.000, 'manual', CURRENT_DATE), -- Soğan          10 kg
  (10, 'in',   8.000, 'manual', CURRENT_DATE), -- Domates         8 kg
  (11, 'in',   6.000, 'manual', CURRENT_DATE), -- Biber           6 kg
  (12, 'in',  12.000, 'manual', CURRENT_DATE), -- Ispanak        12 kg
  (13, 'in',   8.000, 'manual', CURRENT_DATE), -- Havuç           8 kg
  (14, 'in',  20.000, 'manual', CURRENT_DATE), -- Fasulye        20 kg
  (15, 'in',  50.000, 'manual', CURRENT_DATE), -- Süt            50 litre
  (16, 'in',   3.000, 'manual', CURRENT_DATE), -- Tereyağı        3 kg
  (17, 'in',  10.000, 'manual', CURRENT_DATE), -- Sıvı Yağ      10 litre
  (18, 'in',   5.000, 'manual', CURRENT_DATE), -- Salça           5 kg
  (19, 'in',   4.000, 'manual', CURRENT_DATE), -- Tuz             4 kg
  (20, 'in',  10.000, 'manual', CURRENT_DATE), -- Un             10 kg
  (21, 'in', 200.000, 'manual', CURRENT_DATE), -- Yumurta       200 adet
  (22, 'in',  15.000, 'manual', CURRENT_DATE), -- Beyaz Peynir   15 kg
  (23, 'in',  10.000, 'manual', CURRENT_DATE), -- Siyah Zeytin   10 kg
  (24, 'in',  15.000, 'manual', CURRENT_DATE), -- Yulaf Ezmesi   15 kg
  (25, 'in',  30.000, 'manual', CURRENT_DATE)  -- Elma           30 kg
ON CONFLICT DO NOTHING;
