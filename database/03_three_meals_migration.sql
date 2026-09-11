-- ============================================================
-- ANAOKULU 3 ÖĞÜNLÜ SİSTEM MİGRASYONU (v3)
-- Kahvaltı, Öğle Yemeği, İkindi Kahvaltısı
-- ============================================================

-- 1. TABLOLARA meal_type KOLONLARINI EKLE
ALTER TABLE recipes 
ADD COLUMN IF NOT EXISTS meal_type VARCHAR(20) NOT NULL DEFAULT 'ogle' 
CHECK (meal_type IN ('kahvalti', 'ogle', 'ikindi'));

ALTER TABLE weekly_menu 
ADD COLUMN IF NOT EXISTS meal_type VARCHAR(20) NOT NULL DEFAULT 'ogle' 
CHECK (meal_type IN ('kahvalti', 'ogle', 'ikindi'));

ALTER TABLE meal_plans 
ADD COLUMN IF NOT EXISTS meal_type VARCHAR(20) NOT NULL DEFAULT 'ogle' 
CHECK (meal_type IN ('kahvalti', 'ogle', 'ikindi'));

-- 2. TRIGGER'I HEM INSERT HEM DELETE İÇİN GÜNCELLE
CREATE OR REPLACE FUNCTION update_current_stock()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO current_stock (product_id, quantity, last_updated)
        VALUES (
            NEW.product_id,
            CASE WHEN NEW.transaction_type = 'in' THEN NEW.quantity ELSE -NEW.quantity END,
            NOW()
        )
        ON CONFLICT (product_id) DO UPDATE
        SET quantity = current_stock.quantity +
                CASE WHEN NEW.transaction_type = 'in' THEN NEW.quantity ELSE -NEW.quantity END,
            last_updated = NOW();
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE current_stock
        SET quantity = current_stock.quantity -
                CASE WHEN OLD.transaction_type = 'in' THEN OLD.quantity ELSE -OLD.quantity END,
            last_updated = NOW()
        WHERE product_id = OLD.product_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_stock ON stock_transactions;
CREATE TRIGGER trg_update_stock
AFTER INSERT OR DELETE ON stock_transactions
FOR EACH ROW EXECUTE FUNCTION update_current_stock();

-- 3. YENİ KAHVALTI VE İKİNDİ ÜRÜNLERİNİ EKLE (Mevcut 20 ürüne ek olarak 21-25)
INSERT INTO products (id, name, unit, category, critical_threshold, protein_per_unit) VALUES
  (21, 'Yumurta',        'adet',  'kahvaltılık', 30.00,  6.300),
  (22, 'Beyaz Peynir',   'kg',    'süt ürünleri', 2.00, 18.000),
  (23, 'Siyah Zeytin',   'kg',    'kahvaltılık',  1.50,  0.800),
  (24, 'Yulaf Ezmesi',   'kg',    'tahıl',        2.00, 13.500),
  (25, 'Elma',           'kg',    'meyve',        3.00,  0.300)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name, unit = EXCLUDED.unit, category = EXCLUDED.category,
    critical_threshold = EXCLUDED.critical_threshold, protein_per_unit = EXCLUDED.protein_per_unit;

SELECT setval(pg_get_serial_sequence('products', 'id'), COALESCE(MAX(id), 1)) FROM products;

-- Mevcut öğle yemeği reçetelerinin meal_type'ını 'ogle' olarak doğrula
UPDATE recipes SET meal_type = 'ogle' WHERE id <= 7;

-- 4. YENİ REÇETELER EKLE (Kahvaltı ve İkindi)
INSERT INTO recipes (id, meal_name, meal_type) VALUES
  -- Kahvaltı Reçeteleri (id 8 - 12)
  ( 8, 'Peynirli Klasik Kahvaltı',   'kahvalti'),
  ( 9, 'Sütlü Yulaf Lapası & Meyve',  'kahvalti'),
  (10, 'Menemen & Ekmek',            'kahvalti'),
  (11, 'Krep / Pankek & Süt',        'kahvalti'),
  (12, 'Haşlanmış Yumurta & Peynir', 'kahvalti'),
  -- İkindi Kahvaltısı Reçeteleri (id 13 - 17)
  (13, 'Havuçlu Anne Keki & Süt',    'ikindi'),
  (14, 'Ev Yapımı Peynirli Poğaça',  'ikindi'),
  (15, 'Süt & Taze Elma Dilimleri',  'ikindi'),
  (16, 'Peynirli Mini Sandviç',      'ikindi'),
  (17, 'Meyveli Yoğurt & Yulaf',     'ikindi')
ON CONFLICT (id) DO UPDATE 
SET meal_name = EXCLUDED.meal_name, meal_type = EXCLUDED.meal_type;

-- SERIAL id sayacını güncelle (recipes için)
SELECT setval(pg_get_serial_sequence('recipes', 'id'), COALESCE(MAX(id), 1)) FROM recipes;

-- 5. REÇETE MALZEMELERİ (Porsiyon başına miktarlar)
-- Eski kahvaltı/ikindi malzemeleri varsa temizle (8-17)
DELETE FROM recipe_ingredients WHERE recipe_id >= 8;

-- Reçete 8: Peynirli Klasik Kahvaltı
INSERT INTO recipe_ingredients (recipe_id, product_id, quantity_per_portion) VALUES
  (8, 21, 1.0000),  -- Yumurta 1 adet
  (8, 22, 0.0300),  -- Beyaz Peynir 30 g
  (8, 23, 0.0200),  -- Siyah Zeytin 20 g
  (8, 10, 0.0300),  -- Domates 30 g
  (8, 15, 0.1500);  -- Süt 150 ml

-- Reçete 9: Sütlü Yulaf Lapası & Meyve
INSERT INTO recipe_ingredients (recipe_id, product_id, quantity_per_portion) VALUES
  (9, 24, 0.0400),  -- Yulaf 40 g
  (9, 15, 0.1500),  -- Süt 150 ml
  (9, 16, 0.0050),  -- Tereyağı 5 g
  (9, 25, 0.0500);  -- Elma 50 g

-- Reçete 10: Menemen & Ekmek
INSERT INTO recipe_ingredients (recipe_id, product_id, quantity_per_portion) VALUES
  (10, 21, 1.0000),  -- Yumurta 1 adet
  (10, 10, 0.0600),  -- Domates 60 g
  (10, 11, 0.0200),  -- Biber 20 g
  (10, 16, 0.0050),  -- Tereyağı 5 g
  (10, 19, 0.0010);  -- Tuz 1 g

-- Reçete 11: Krep / Pankek & Süt
INSERT INTO recipe_ingredients (recipe_id, product_id, quantity_per_portion) VALUES
  (11, 20, 0.0400),  -- Un 40 g
  (11, 15, 0.1500),  -- Süt 150 ml
  (11, 21, 0.5000),  -- Yumurta 0.5 adet
  (11, 16, 0.0050);  -- Tereyağı 5 g

-- Reçete 12: Haşlanmış Yumurta & Peynir (Cuma Kahvaltısı)
INSERT INTO recipe_ingredients (recipe_id, product_id, quantity_per_portion) VALUES
  (12, 21, 1.0000),  -- Yumurta 1 adet
  (12, 22, 0.0400),  -- Beyaz Peynir 40 g
  (12, 23, 0.0200),  -- Siyah Zeytin 20 g
  (12, 15, 0.1500);  -- Süt 150 ml

-- Reçete 13: Havuçlu Anne Keki & Süt
INSERT INTO recipe_ingredients (recipe_id, product_id, quantity_per_portion) VALUES
  (13, 20, 0.0350),  -- Un 35 g
  (13, 13, 0.0250),  -- Havuç 25 g
  (13, 15, 0.1500),  -- Süt 150 ml
  (13, 17, 0.0060),  -- Sıvı Yağ 6 ml
  (13, 21, 0.3000);  -- Yumurta 0.3 adet

-- Reçete 14: Ev Yapımı Peynirli Poğaça
INSERT INTO recipe_ingredients (recipe_id, product_id, quantity_per_portion) VALUES
  (14, 20, 0.0400),  -- Un 40 g
  (14, 22, 0.0200),  -- Beyaz Peynir 20 g
  (14, 16, 0.0080),  -- Tereyağı 8 g
  (14, 15, 0.1000),  -- Süt 100 ml
  (14, 19, 0.0010);  -- Tuz 1 g

-- Reçete 15: Süt & Taze Elma Dilimleri
INSERT INTO recipe_ingredients (recipe_id, product_id, quantity_per_portion) VALUES
  (15, 15, 0.1500),  -- Süt 150 ml
  (15, 25, 0.1000);  -- Elma 100 g

-- Reçete 16: Peynirli Mini Sandviç
INSERT INTO recipe_ingredients (recipe_id, product_id, quantity_per_portion) VALUES
  (16, 20, 0.0400),  -- Un 40 g
  (16, 22, 0.0250),  -- Beyaz Peynir 25 g
  (16, 10, 0.0200),  -- Domates 20 g
  (16, 16, 0.0050);  -- Tereyağı 5 g

-- Reçete 17: Meyveli Yoğurt & Yulaf (Cuma İkindisi)
INSERT INTO recipe_ingredients (recipe_id, product_id, quantity_per_portion) VALUES
  (17, 15, 0.1500),  -- Süt 150 ml
  (17, 25, 0.0600),  -- Elma 60 g
  (17, 24, 0.0250);  -- Yulaf 25 g

-- 6. HAFTALIK MENÜ (Günde 3 Öğün: 5 gün x 3 öğün = 15 kayıt)
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

-- 7. YENİ ÜRÜNLER İÇİN BAŞLANGIÇ STOĞU (Eğer daha önce girilmediyse)
INSERT INTO stock_transactions (product_id, transaction_type, quantity, source_type, transaction_date)
SELECT 21, 'in', 200.000, 'manual', CURRENT_DATE
WHERE NOT EXISTS (SELECT 1 FROM stock_transactions WHERE product_id = 21 AND transaction_type = 'in');

INSERT INTO stock_transactions (product_id, transaction_type, quantity, source_type, transaction_date)
SELECT 22, 'in', 15.000, 'manual', CURRENT_DATE
WHERE NOT EXISTS (SELECT 1 FROM stock_transactions WHERE product_id = 22 AND transaction_type = 'in');

INSERT INTO stock_transactions (product_id, transaction_type, quantity, source_type, transaction_date)
SELECT 23, 'in', 10.000, 'manual', CURRENT_DATE
WHERE NOT EXISTS (SELECT 1 FROM stock_transactions WHERE product_id = 23 AND transaction_type = 'in');

INSERT INTO stock_transactions (product_id, transaction_type, quantity, source_type, transaction_date)
SELECT 24, 'in', 15.000, 'manual', CURRENT_DATE
WHERE NOT EXISTS (SELECT 1 FROM stock_transactions WHERE product_id = 24 AND transaction_type = 'in');

INSERT INTO stock_transactions (product_id, transaction_type, quantity, source_type, transaction_date)
SELECT 25, 'in', 30.000, 'manual', CURRENT_DATE
WHERE NOT EXISTS (SELECT 1 FROM stock_transactions WHERE product_id = 25 AND transaction_type = 'in');
