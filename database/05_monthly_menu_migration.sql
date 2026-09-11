-- ==============================================================================
-- 2-6 Yaş Grubu Normlarına Uygun Porsiyon Gramajları
-- ==============================================================================

-- 1. weekly_menu tablosuna week_number kolonu ekle
ALTER TABLE weekly_menu 
ADD COLUMN IF NOT EXISTS week_number SMALLINT NOT NULL DEFAULT 1 
CHECK (week_number BETWEEN 1 AND 4);

-- 2. Yeni Ürünler (26-43)
INSERT INTO products (id, name, unit, category, critical_threshold, protein_per_unit) VALUES
  (26, 'Salatalık',                  'kg',    'sebze',         3.00,  0.700),
  (27, 'Tam Buğday Ekmeği',         'adet',  'fırın',        10.00,  8.500),
  (28, 'Yoğurt',                    'kg',    'süt ürünleri',  5.00,  3.500),
  (29, 'Kabak',                     'kg',    'sebze',         3.00,  1.200),
  (30, 'Muz',                       'kg',    'meyve',         4.00,  1.100),
  (31, 'Armut',                     'kg',    'meyve',         3.00,  0.400),
  (32, 'Kuru Fasulye (Kuru)',       'kg',    'bakliyat',      5.00, 21.000),
  (33, 'Kılçıksız Balık Fileto',   'kg',    'et & balık',    5.00, 19.000),
  (34, 'Makarna / Erişte',          'kg',    'tahıl',         5.00, 12.000),
  (35, 'Lor Peyniri',               'kg',    'süt ürünleri',  2.00, 11.000),
  (36, 'Kaşar Peyniri',             'kg',    'süt ürünleri',  2.00, 25.000),
  (37, 'Kuşbaşı Et (dana)',         'kg',    'et & balık',    5.00, 20.000),
  (38, 'Bezelye',                   'kg',    'sebze',         3.00,  5.400),
  (39, 'Yeşil Mercimek',            'kg',    'bakliyat',      3.00, 24.000),
  (40, 'Tarhana',                   'kg',    'çorbalık',      2.00, 12.000),
  (41, 'Böreklik Yufka',            'kg',    'unlu mamül',    2.00,  7.000),
  (42, 'Şeker',                     'kg',    'kuru gıda',     2.00,  0.000),
  (43, 'Marul / Salata Yeşilliği',  'kg',    'sebze',         2.00,  1.200)
ON CONFLICT (id) DO UPDATE 
SET name = EXCLUDED.name, unit = EXCLUDED.unit, category = EXCLUDED.category,
    critical_threshold = EXCLUDED.critical_threshold, protein_per_unit = EXCLUDED.protein_per_unit;

SELECT setval(pg_get_serial_sequence('products', 'id'), COALESCE(MAX(id), 1)) FROM products;

-- 3. Yeni Ürünler İçin Başlangıç Stoğu
INSERT INTO stock_transactions (product_id, transaction_type, quantity, source_type, transaction_date)
SELECT 26, 'in', 20.000, 'manual', CURRENT_DATE WHERE NOT EXISTS (SELECT 1 FROM stock_transactions WHERE product_id = 26 AND transaction_type = 'in');
INSERT INTO stock_transactions (product_id, transaction_type, quantity, source_type, transaction_date)
SELECT 27, 'in', 50.000, 'manual', CURRENT_DATE WHERE NOT EXISTS (SELECT 1 FROM stock_transactions WHERE product_id = 27 AND transaction_type = 'in');
INSERT INTO stock_transactions (product_id, transaction_type, quantity, source_type, transaction_date)
SELECT 28, 'in', 30.000, 'manual', CURRENT_DATE WHERE NOT EXISTS (SELECT 1 FROM stock_transactions WHERE product_id = 28 AND transaction_type = 'in');
INSERT INTO stock_transactions (product_id, transaction_type, quantity, source_type, transaction_date)
SELECT 29, 'in', 20.000, 'manual', CURRENT_DATE WHERE NOT EXISTS (SELECT 1 FROM stock_transactions WHERE product_id = 29 AND transaction_type = 'in');
INSERT INTO stock_transactions (product_id, transaction_type, quantity, source_type, transaction_date)
SELECT 30, 'in', 25.000, 'manual', CURRENT_DATE WHERE NOT EXISTS (SELECT 1 FROM stock_transactions WHERE product_id = 30 AND transaction_type = 'in');
INSERT INTO stock_transactions (product_id, transaction_type, quantity, source_type, transaction_date)
SELECT 31, 'in', 25.000, 'manual', CURRENT_DATE WHERE NOT EXISTS (SELECT 1 FROM stock_transactions WHERE product_id = 31 AND transaction_type = 'in');
INSERT INTO stock_transactions (product_id, transaction_type, quantity, source_type, transaction_date)
SELECT 32, 'in', 25.000, 'manual', CURRENT_DATE WHERE NOT EXISTS (SELECT 1 FROM stock_transactions WHERE product_id = 32 AND transaction_type = 'in');
INSERT INTO stock_transactions (product_id, transaction_type, quantity, source_type, transaction_date)
SELECT 33, 'in', 20.000, 'manual', CURRENT_DATE WHERE NOT EXISTS (SELECT 1 FROM stock_transactions WHERE product_id = 33 AND transaction_type = 'in');
INSERT INTO stock_transactions (product_id, transaction_type, quantity, source_type, transaction_date)
SELECT 34, 'in', 30.000, 'manual', CURRENT_DATE WHERE NOT EXISTS (SELECT 1 FROM stock_transactions WHERE product_id = 34 AND transaction_type = 'in');
INSERT INTO stock_transactions (product_id, transaction_type, quantity, source_type, transaction_date)
SELECT 35, 'in', 15.000, 'manual', CURRENT_DATE WHERE NOT EXISTS (SELECT 1 FROM stock_transactions WHERE product_id = 35 AND transaction_type = 'in');
INSERT INTO stock_transactions (product_id, transaction_type, quantity, source_type, transaction_date)
SELECT 36, 'in', 15.000, 'manual', CURRENT_DATE WHERE NOT EXISTS (SELECT 1 FROM stock_transactions WHERE product_id = 36 AND transaction_type = 'in');
INSERT INTO stock_transactions (product_id, transaction_type, quantity, source_type, transaction_date)
SELECT 37, 'in', 20.000, 'manual', CURRENT_DATE WHERE NOT EXISTS (SELECT 1 FROM stock_transactions WHERE product_id = 37 AND transaction_type = 'in');
INSERT INTO stock_transactions (product_id, transaction_type, quantity, source_type, transaction_date)
SELECT 38, 'in', 15.000, 'manual', CURRENT_DATE WHERE NOT EXISTS (SELECT 1 FROM stock_transactions WHERE product_id = 38 AND transaction_type = 'in');
INSERT INTO stock_transactions (product_id, transaction_type, quantity, source_type, transaction_date)
SELECT 39, 'in', 20.000, 'manual', CURRENT_DATE WHERE NOT EXISTS (SELECT 1 FROM stock_transactions WHERE product_id = 39 AND transaction_type = 'in');
INSERT INTO stock_transactions (product_id, transaction_type, quantity, source_type, transaction_date)
SELECT 40, 'in', 10.000, 'manual', CURRENT_DATE WHERE NOT EXISTS (SELECT 1 FROM stock_transactions WHERE product_id = 40 AND transaction_type = 'in');
INSERT INTO stock_transactions (product_id, transaction_type, quantity, source_type, transaction_date)
SELECT 41, 'in', 15.000, 'manual', CURRENT_DATE WHERE NOT EXISTS (SELECT 1 FROM stock_transactions WHERE product_id = 41 AND transaction_type = 'in');
INSERT INTO stock_transactions (product_id, transaction_type, quantity, source_type, transaction_date)
SELECT 42, 'in', 15.000, 'manual', CURRENT_DATE WHERE NOT EXISTS (SELECT 1 FROM stock_transactions WHERE product_id = 42 AND transaction_type = 'in');
INSERT INTO stock_transactions (product_id, transaction_type, quantity, source_type, transaction_date)
SELECT 43, 'in', 15.000, 'manual', CURRENT_DATE WHERE NOT EXISTS (SELECT 1 FROM stock_transactions WHERE product_id = 43 AND transaction_type = 'in');

-- 4. 4 Haftanın Reçeteleri (id 19-67)
INSERT INTO recipes (id, meal_name, meal_type) VALUES
  (19, 'Haşlanmış Yumurta, Beyaz Peynir, Ekmek, Salatalık', 'kahvalti'),
  (20, 'Mercimek Çorbası, Kıymalı Kabak, Bulgur Pilavı, Yoğurt', 'ogle'),
  (21, 'Mevsim Meyvesi & Süt', 'ikindi'),
  (22, 'Peynirli Omlet, Ekmek, Domates', 'kahvalti'),
  (23, 'Fırında Tavuk, Sebzeli Pirinç Pilavı, Cacık', 'ogle'),
  (24, 'Yoğurt, Yumuşatılmış Yulaf, Muz', 'ikindi'),
  (25, 'Sütle Hazırlanmış Yulaf Lapası, Armut', 'kahvalti'),
  (26, 'Kuru Fasulye, Bulgur Pilavı, Mevsim Salatası', 'ogle'),
  (27, 'Az Şekerli Ev Yapımı Kek, Ayran', 'ikindi'),
  (28, 'Peynirli Tost, Domates, Süt', 'kahvalti'),
  (29, 'Sebze Çorbası, Fırında Köfte, Patates Püresi, Yoğurt', 'ogle'),
  (30, 'Mevsim Meyvesi Tabağı', 'ikindi'),
  (31, 'Haşlanmış Yumurta, Lor Peyniri, Ekmek, Salatalık', 'kahvalti'),
  (32, 'Fırında Kılçıksız Balık, Sebzeli Makarna, Salata', 'ogle'),
  (33, 'Ev Yapımı Peynirli Poğaça, Ayran', 'ikindi'),
  (34, 'Menemen, Beyaz Peynir, Ekmek', 'kahvalti'),
  (35, 'Nohut Yemeği, Pirinç Pilavı, Cacık', 'ogle'),
  (36, 'Mevsim Meyvesi & Yoğurt', 'ikindi'),
  (37, 'Peynirli Krep, Salatalık, Süt', 'kahvalti'),
  (38, 'Tarhana Çorbası, Etli Taze Fasulye, Bulgur Pilavı', 'ogle'),
  (39, 'Muzlu Yulaflı Ev Kurabiyesi, Süt', 'ikindi'),
  (40, 'Haşlanmış Yumurta, Peynir, Ekmek, Domates', 'kahvalti'),
  (41, 'Sebzeli Tavuk Sote, Makarna, Yoğurt', 'ogle'),
  (42, 'Mevsim Meyvesi & Ayran', 'ikindi'),
  (43, 'Sütlü Yulaf Lapası, Muz', 'kahvalti'),
  (44, 'Yeşil Mercimek Yemeği, Sebzeli Bulgur Pilavı, Yoğurt', 'ogle'),
  (45, 'Fırında Peynirli Börek, Domates', 'ikindi'),
  (46, 'Peynirli Omlet, Ekmek, Salatalık', 'kahvalti'),
  (47, 'Yayla Çorbası, Kıymalı Sebze Dolması, Salata', 'ogle'),
  (48, 'Az Şekerli Sütlaç', 'ikindi'),
  (49, 'Sebze Çorbası, Fırında Tavuk, Bulgur Pilavı, Cacık', 'ogle'),
  (50, 'Peynirli Tost, Salatalık, Süt', 'kahvalti'),
  (51, 'Etli Bezelye, Pirinç Pilavı, Yoğurt', 'ogle'),
  (52, 'Elmalı Yoğurt, Yumuşatılmış Yulaf', 'ikindi'),
  (53, 'Sebzeli Omlet, Ekmek', 'kahvalti'),
  (54, 'Fırında Kılçıksız Balık, Fırın Patates, Yoğurtlu Havuç', 'ogle'),
  (55, 'Mevsim Meyvesi, Peynirli Küçük Sandviç', 'ikindi'),
  (56, 'Mercimek Çorbası, Fırında Sebzeli Mücver, Yoğurt', 'ogle'),
  (57, 'Az Şekerli Ev Yapımı Kek, Süt', 'ikindi'),
  (58, 'Etli Nohut, Bulgur Pilavı, Cacık', 'ogle'),
  (59, 'Peynirli Krep, Domates, Süt', 'kahvalti'),
  (60, 'Sebze Çorbası, Fırında Köfte, Sebzeli Makarna, Salata', 'ogle'),
  (61, 'Muz, Süt', 'ikindi'),
  (62, 'Tavuklu Sebze Yemeği, Pirinç Pilavı, Yoğurt', 'ogle'),
  (63, 'Fırında Peynirli Börek, Ayran', 'ikindi'),
  (64, 'Sütlü Yulaf Lapası, Elma', 'kahvalti'),
  (65, 'Yeşil Mercimek Yemeği, Erişte, Cacık', 'ogle'),
  (66, 'Tarhana Çorbası, Kıymalı Ispanak, Bulgur Pilavı, Yoğurt', 'ogle'),
  (67, 'Az Şekerli Muhallebi, Mevsim Meyvesi', 'ikindi')
ON CONFLICT (id) DO UPDATE
SET meal_name = EXCLUDED.meal_name, meal_type = EXCLUDED.meal_type;

SELECT setval(pg_get_serial_sequence('recipes', 'id'), COALESCE(MAX(id), 1)) FROM recipes;
