-- ====================================================================
-- ANAOKULU 1 AYLIK (20 OKUL GÜNÜ) TAKVİM MENÜSÜ & REÇETE DÜZENLEMESİ
-- Gerçek Takvim Doğrulaması:
-- 1 Eylül 2026 = Salı
-- 7 Eylül 2026 = Pazartesi (Eylül 2026'nın ilk Pazartesi günü)
-- Başlangıç Tarihi: 2026-09-07 (1. Hafta Pazartesi)
-- Bitiş Tarihi:     2026-10-02 (4. Hafta Cuma)
-- Bugün:            2026-09-11 (Cuma) -> 1. Hafta Cuma Menüsü
-- ====================================================================

-- 1. RECIPES TABLOSUNA is_draft KOLONU EKLE
ALTER TABLE recipes 
ADD COLUMN IF NOT EXISTS is_draft BOOLEAN NOT NULL DEFAULT false;

-- 2. MONTHLY_MENU TABLOSUNU OLUŞTUR
CREATE TABLE IF NOT EXISTS monthly_menu (
    id SERIAL PRIMARY KEY,
    day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 1 AND 5),
    date DATE NOT NULL,
    menu_date DATE GENERATED ALWAYS AS (date) STORED,
    week_number SMALLINT NOT NULL CHECK (week_number BETWEEN 1 AND 4),
    meal_type VARCHAR(20) NOT NULL CHECK (meal_type IN ('kahvalti', 'ogle', 'ikindi')),
    recipe_id INTEGER NOT NULL REFERENCES recipes(id),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (date, meal_type)
);

-- RLS İzni (REST API ve Panel Erişimi için)
ALTER TABLE monthly_menu ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to monthly_menu" ON monthly_menu;
CREATE POLICY "Allow all access to monthly_menu" ON monthly_menu FOR ALL USING (true);

-- 3. PDF'TEN EKLENEN TÜM YENİ REÇETELERİ is_draft = true OLARAK İŞARETLE
UPDATE recipes 
SET is_draft = true 
WHERE id >= 19;

-- 4. ESKİ TEST VERİLERİNİ (Örn: Ispanak Yemeği vb.) WEEKLY_MENU'DEN TEMİZLE
DELETE FROM weekly_menu 
WHERE recipe_id <= 18;

-- 5. 20 OKUL GÜNÜNÜN (60 ÖĞÜN) GERÇEK TARİHLERLE MONTHLY_MENU'YE İŞLENMESİ
DELETE FROM monthly_menu WHERE date BETWEEN '2026-09-01' AND '2026-10-05';

INSERT INTO monthly_menu (day_of_week, date, week_number, meal_type, recipe_id) VALUES

  -- ══════════════════ 1. HAFTA (2026-09-07 - Hafta Sonu) ══════════════════
  -- Pazartesi (2026-09-07)
  (1, '2026-09-07', 1, 'kahvalti', 19) -- Haşlanmış Yumurta, Beyaz Peynir, Ekmek, Salatalık,
  (1, '2026-09-07', 1, 'ogle', 20) -- Mercimek Çorbası, Kıymalı Kabak, Bulgur Pilavı, Yoğurt,
  (1, '2026-09-07', 1, 'ikindi', 21) -- Mevsim Meyvesi & Süt,
  -- Salı (2026-09-08)
  (2, '2026-09-08', 1, 'kahvalti', 22) -- Peynirli Omlet, Ekmek, Domates,
  (2, '2026-09-08', 1, 'ogle', 23) -- Fırında Tavuk, Sebzeli Pirinç Pilavı, Cacık,
  (2, '2026-09-08', 1, 'ikindi', 24) -- Yoğurt, Yumuşatılmış Yulaf, Muz,
  -- Çarşamba (2026-09-09)
  (3, '2026-09-09', 1, 'kahvalti', 25) -- Sütle Hazırlanmış Yulaf Lapası, Armut,
  (3, '2026-09-09', 1, 'ogle', 26) -- Kuru Fasulye, Bulgur Pilavı, Mevsim Salatası,
  (3, '2026-09-09', 1, 'ikindi', 27) -- Az Şekerli Ev Yapımı Kek, Ayran,
  -- Perşembe (2026-09-10)
  (4, '2026-09-10', 1, 'kahvalti', 28) -- Peynirli Tost, Domates, Süt,
  (4, '2026-09-10', 1, 'ogle', 29) -- Sebze Çorbası, Fırında Köfte, Patates Püresi, Yoğurt,
  (4, '2026-09-10', 1, 'ikindi', 30) -- Mevsim Meyvesi Tabağı,
  -- Cuma (2026-09-11) [BUGÜN!]
  (5, '2026-09-11', 1, 'kahvalti', 31) -- Haşlanmış Yumurta, Lor Peyniri, Ekmek, Salatalık,
  (5, '2026-09-11', 1, 'ogle', 32) -- Fırında Kılçıksız Balık, Sebzeli Makarna, Salata,
  (5, '2026-09-11', 1, 'ikindi', 33) -- Ev Yapımı Peynirli Poğaça, Ayran,

  -- ══════════════════ 2. HAFTA (2026-09-14 - Hafta Sonu) ══════════════════
  -- Pazartesi (2026-09-14)
  (1, '2026-09-14', 2, 'kahvalti', 34) -- Menemen, Beyaz Peynir, Ekmek,
  (1, '2026-09-14', 2, 'ogle', 35) -- Nohut Yemeği, Pirinç Pilavı, Cacık,
  (1, '2026-09-14', 2, 'ikindi', 36) -- Mevsim Meyvesi & Yoğurt,
  -- Salı (2026-09-15)
  (2, '2026-09-15', 2, 'kahvalti', 37) -- Peynirli Krep, Salatalık, Süt,
  (2, '2026-09-15', 2, 'ogle', 38) -- Tarhana Çorbası, Etli Taze Fasulye, Bulgur Pilavı,
  (2, '2026-09-15', 2, 'ikindi', 39) -- Muzlu Yulaflı Ev Kurabiyesi, Süt,
  -- Çarşamba (2026-09-16)
  (3, '2026-09-16', 2, 'kahvalti', 40) -- Haşlanmış Yumurta, Peynir, Ekmek, Domates,
  (3, '2026-09-16', 2, 'ogle', 41) -- Sebzeli Tavuk Sote, Makarna, Yoğurt,
  (3, '2026-09-16', 2, 'ikindi', 42) -- Mevsim Meyvesi & Ayran,
  -- Perşembe (2026-09-17)
  (4, '2026-09-17', 2, 'kahvalti', 43) -- Sütlü Yulaf Lapası, Muz,
  (4, '2026-09-17', 2, 'ogle', 44) -- Yeşil Mercimek Yemeği, Sebzeli Bulgur Pilavı, Yoğurt,
  (4, '2026-09-17', 2, 'ikindi', 45) -- Fırında Peynirli Börek, Domates,
  -- Cuma (2026-09-18)
  (5, '2026-09-18', 2, 'kahvalti', 46) -- Peynirli Omlet, Ekmek, Salatalık,
  (5, '2026-09-18', 2, 'ogle', 47) -- Yayla Çorbası, Kıymalı Sebze Dolması, Salata,
  (5, '2026-09-18', 2, 'ikindi', 48) -- Az Şekerli Sütlaç,

  -- ══════════════════ 3. HAFTA (2026-09-21 - Hafta Sonu) ══════════════════
  -- Pazartesi (2026-09-21)
  (1, '2026-09-21', 3, 'kahvalti', 40) -- Haşlanmış Yumurta, Peynir, Ekmek, Domates,
  (1, '2026-09-21', 3, 'ogle', 49) -- Sebze Çorbası, Fırında Tavuk, Bulgur Pilavı, Cacık,
  (1, '2026-09-21', 3, 'ikindi', 21) -- Mevsim Meyvesi & Süt,
  -- Salı (2026-09-22)
  (2, '2026-09-22', 3, 'kahvalti', 50) -- Peynirli Tost, Salatalık, Süt,
  (2, '2026-09-22', 3, 'ogle', 51) -- Etli Bezelye, Pirinç Pilavı, Yoğurt,
  (2, '2026-09-22', 3, 'ikindi', 52) -- Elmalı Yoğurt, Yumuşatılmış Yulaf,
  -- Çarşamba (2026-09-23)
  (3, '2026-09-23', 3, 'kahvalti', 53) -- Sebzeli Omlet, Ekmek,
  (3, '2026-09-23', 3, 'ogle', 26) -- Kuru Fasulye, Bulgur Pilavı, Salata,
  (3, '2026-09-23', 3, 'ikindi', 33) -- Ev Yapımı Peynirli Poğaça, Ayran,
  -- Perşembe (2026-09-24)
  (4, '2026-09-24', 3, 'kahvalti', 25) -- Sütle Hazırlanmış Yulaf Lapası, Armut,
  (4, '2026-09-24', 3, 'ogle', 54) -- Fırında Kılçıksız Balık, Fırın Patates, Yoğurtlu Havuç,
  (4, '2026-09-24', 3, 'ikindi', 55) -- Mevsim Meyvesi, Peynirli Küçük Sandviç,
  -- Cuma (2026-09-25)
  (5, '2026-09-25', 3, 'kahvalti', 31) -- Haşlanmış Yumurta, Lor Peyniri, Ekmek, Salatalık,
  (5, '2026-09-25', 3, 'ogle', 56) -- Mercimek Çorbası, Fırında Sebzeli Mücver, Yoğurt,
  (5, '2026-09-25', 3, 'ikindi', 57) -- Az Şekerli Ev Yapımı Kek, Süt,

  -- ══════════════════ 4. HAFTA (2026-09-28 - Hafta Sonu) ══════════════════
  -- Pazartesi (2026-09-28)
  (1, '2026-09-28', 4, 'kahvalti', 34) -- Menemen, Beyaz Peynir, Ekmek,
  (1, '2026-09-28', 4, 'ogle', 58) -- Etli Nohut, Bulgur Pilavı, Cacık,
  (1, '2026-09-28', 4, 'ikindi', 36) -- Mevsim Meyvesi & Yoğurt,
  -- Salı (2026-09-29)
  (2, '2026-09-29', 4, 'kahvalti', 59) -- Peynirli Krep, Domates, Süt,
  (2, '2026-09-29', 4, 'ogle', 60) -- Sebze Çorbası, Fırında Köfte, Sebzeli Makarna, Salata,
  (2, '2026-09-29', 4, 'ikindi', 61) -- Muz, Süt,
  -- Çarşamba (2026-09-30)
  (3, '2026-09-30', 4, 'kahvalti', 19) -- Haşlanmış Yumurta, Beyaz Peynir, Ekmek, Salatalık,
  (3, '2026-09-30', 4, 'ogle', 62) -- Tavuklu Sebze Yemeği, Pirinç Pilavı, Yoğurt,
  (3, '2026-09-30', 4, 'ikindi', 63) -- Fırında Peynirli Börek, Ayran,
  -- Perşembe (2026-10-01)
  (4, '2026-10-01', 4, 'kahvalti', 64) -- Sütlü Yulaf Lapası, Elma,
  (4, '2026-10-01', 4, 'ogle', 65) -- Yeşil Mercimek Yemeği, Erişte, Cacık,
  (4, '2026-10-01', 4, 'ikindi', 55) -- Mevsim Meyvesi, Peynirli Küçük Sandviç,
  -- Cuma (2026-10-02)
  (5, '2026-10-02', 4, 'kahvalti', 22) -- Peynirli Omlet, Ekmek, Domates,
  (5, '2026-10-02', 4, 'ogle', 66) -- Tarhana Çorbası, Kıymalı Ispanak, Bulgur Pilavı, Yoğurt,
  (5, '2026-10-02', 4, 'ikindi', 67) -- Az Şekerli Muhallebi, Mevsim Meyvesi;

-- ====================================================================
-- 6. DOĞRULAMA VE KANIT SORGULARI
-- ====================================================================

-- 6.1. İlk 5 kayıt: day_of_week ve date listesi
SELECT day_of_week, date 
FROM monthly_menu 
ORDER BY date 
LIMIT 5;

-- 6.2. Gerçek takvim eşleşmesini kanıtlayan sorgu (Pazartesi=1, Salı=2...)
SELECT DISTINCT 
    m.day_of_week, 
    m.date, 
    to_char(m.date, 'Day')   AS gercek_takvim_gunu_en,
    to_char(m.date, 'TMDay') AS gercek_takvim_gunu_tr
FROM monthly_menu m 
ORDER BY m.date 
LIMIT 5;

-- 6.3. Bugünün (2026-09-11, Cuma) eşleşen 3 öğünü:
SELECT 
    m.date,
    m.day_of_week,
    m.meal_type AS ogun,
    r.id AS recipe_id,
    r.meal_name AS yemek_adi,
    r.is_draft AS taslak_mi
FROM monthly_menu m
JOIN recipes r ON r.id = m.recipe_id
WHERE m.date = '2026-09-11'
ORDER BY 
    CASE m.meal_type 
        WHEN 'kahvalti' THEN 1 
        WHEN 'ogle'     THEN 2 
        WHEN 'ikindi'   THEN 3 
    END;
