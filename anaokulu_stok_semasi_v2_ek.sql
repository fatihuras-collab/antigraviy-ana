-- ============================================================
-- ANAOKULU YEMEKHANE STOK TAKİP SİSTEMİ - v2 ŞEMA
-- (v1'e ek: haftalık menü, yemek geri bildirimi, protein takibi)
-- PostgreSQL
-- ============================================================

-- v1'deki tüm tablolar (products, suppliers, invoices, invoice_items,
-- recipes, recipe_ingredients, meal_plans, stock_transactions,
-- current_stock, trigger) aynen geçerli. Aşağıdakiler v2 eklemeleridir.

-- 1. ÜRÜNLERE PROTEİN DEĞERİ EKLE
ALTER TABLE products ADD COLUMN protein_per_unit NUMERIC(10,3); -- gram, 1 birim (kg/litre/adet) başına

-- 2. HAFTALIK MENÜ PROGRAMI
-- "Bugün hangi yemek pişiyor" sorusunu manuel girmeden cevaplamak için
CREATE TABLE weekly_menu (
    id          SERIAL PRIMARY KEY,
    day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 1 AND 7), -- 1=Pazartesi ... 7=Pazar
    recipe_id   INTEGER NOT NULL REFERENCES recipes(id),
    valid_from  DATE NOT NULL DEFAULT CURRENT_DATE,  -- menü güncellenince yeni kayıt açılır, eskisi kapanır
    valid_to    DATE,                                 -- NULL = hâlâ geçerli
    created_at  TIMESTAMP DEFAULT NOW()
);

-- 3. YEMEK GERİ BİLDİRİMİ (az / normal / çok yenildi)
CREATE TABLE meal_feedback (
    id              SERIAL PRIMARY KEY,
    feedback_date   DATE NOT NULL,
    recipe_id       INTEGER NOT NULL REFERENCES recipes(id),
    feedback_level  VARCHAR(10) NOT NULL CHECK (feedback_level IN ('az','normal','cok')),
    created_at      TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- ÖRNEK SORGU: bugünün yemeğini haftalık menüden bul
-- ============================================================
-- SELECT r.* FROM weekly_menu wm
-- JOIN recipes r ON r.id = wm.recipe_id
-- WHERE wm.day_of_week = EXTRACT(ISODOW FROM CURRENT_DATE)
--   AND wm.valid_from <= CURRENT_DATE
--   AND (wm.valid_to IS NULL OR wm.valid_to >= CURRENT_DATE);

-- ============================================================
-- ÖRNEK SORGU: bir reçetenin porsiyon başı protein değeri
-- ============================================================
-- SELECT ri.recipe_id, SUM(ri.quantity_per_portion * p.protein_per_unit) AS protein_g_per_portion
-- FROM recipe_ingredients ri
-- JOIN products p ON p.id = ri.product_id
-- WHERE ri.recipe_id = :recipe_id
-- GROUP BY ri.recipe_id;

-- ============================================================
-- ÖRNEK SORGU: son 5 pişirilişin 3'ünde "az yenildi" alan yemekler
-- (öneri motorunun tetikleyici sorgusu)
-- ============================================================
-- WITH last5 AS (
--   SELECT recipe_id, feedback_level,
--          ROW_NUMBER() OVER (PARTITION BY recipe_id ORDER BY feedback_date DESC) AS rn
--   FROM meal_feedback
-- )
-- SELECT recipe_id, COUNT(*) FILTER (WHERE feedback_level = 'az') AS az_sayisi
-- FROM last5 WHERE rn <= 5
-- GROUP BY recipe_id
-- HAVING COUNT(*) FILTER (WHERE feedback_level = 'az') >= 3;

-- ============================================================
-- ÖRNEK SORGU: aylık menünün toplam protein ortalaması
-- ============================================================
-- SELECT AVG(protein_g_per_portion) AS aylik_ortalama_protein
-- FROM (
--   SELECT mp.id, SUM(ri.quantity_per_portion * p.protein_per_unit) AS protein_g_per_portion
--   FROM meal_plans mp
--   JOIN recipe_ingredients ri ON ri.recipe_id = mp.recipe_id
--   JOIN products p ON p.id = ri.product_id
--   WHERE mp.plan_date >= date_trunc('month', CURRENT_DATE)
--   GROUP BY mp.id
-- ) sub;
