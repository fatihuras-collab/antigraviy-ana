# Anaokulu Yemekhane Stok Takip Otomasyonu — Proje Özeti

## 1. Mevcut durum ve sorun

- Anaokulunda 80 öğrenci var, kapasite 120-150 arası (geçen yıl 50 öğrenciyle faaliyet gösteriliyordu).
- En büyük sorun: yemekhanede hangi ürünün tükendiği son dakikada anlaşılıyor, personel yoğunluktan takip edemiyor.

## 2. Sistemin çalışma mantığı

**Sabah:** Personel sadece o günkü öğrenci sayısını girer (örn. "bugün 70 öğrenci").

**Otomatik hesaplama:** Sistem, haftalık menü programından bugünün yemeğini bulur (örn. Çarşamba = fasulye), reçetedeki porsiyon başı miktarları öğrenci sayısıyla çarpar ve stoktan otomatik düşer.

**Akşam:** Yapay zeka o günkü hareketi özetleyip rapor üretir: hangi üründen ne kadar gitti, stokta ne kaldı, hangi ürün kritik/hangisi fazla/hangisi durgun.

**Stok girişi 3 kanaldan olabilir:**
1. Fatura fotoğrafı — Claude API (vision) ile görsel analiz, otomatik ürün/miktar çıkarımı
2. Sesli komut — konuşma metne çevrilir, AI ürün/miktar/yön çıkarır
3. Manuel giriş — istisna durumlar için

**Yemek popülerlik takibi:** Her pişirilişten sonra personel basit bir skala girer (az / normal / çok yenildi). Son 5 pişirilişin 3'ünde "az yenildi" alan yemekler öneri motoruna girer.

**Öneri motoru:** Popülerlik verisiyle birlikte reçetenin protein değerini (ürün bazlı `protein_per_unit` alanından otomatik hesaplanır) dikkate alarak "bu yemek az seviliyor, yerine benzer proteinli X yemeği önerilebilir" gibi somut öneriler üretir. Sistem otomatik menüden kaldırmaz, sadece önerir — karar personelde/yönetimde kalır.

## 3. Veritabanı şeması (PostgreSQL)

```sql
-- ÜRÜNLER
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    unit VARCHAR(20) NOT NULL,
    category VARCHAR(80),
    critical_threshold NUMERIC(10,2) DEFAULT 0,
    protein_per_unit NUMERIC(10,3),
    created_at TIMESTAMP DEFAULT NOW()
);

-- TEDARİKÇİLER
CREATE TABLE suppliers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    phone VARCHAR(30),
    notes TEXT
);

-- FATURALAR
CREATE TABLE invoices (
    id SERIAL PRIMARY KEY,
    supplier_id INTEGER REFERENCES suppliers(id),
    invoice_no VARCHAR(50),
    invoice_date DATE NOT NULL,
    total_amount NUMERIC(12,2),
    source VARCHAR(20) DEFAULT 'manual', -- 'manual' | 'ocr' | 'voice'
    created_at TIMESTAMP DEFAULT NOW()
);

-- FATURA KALEMLERİ
CREATE TABLE invoice_items (
    id SERIAL PRIMARY KEY,
    invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id),
    quantity NUMERIC(10,2) NOT NULL,
    unit_price NUMERIC(10,2),
    created_at TIMESTAMP DEFAULT NOW()
);

-- REÇETELER
CREATE TABLE recipes (
    id SERIAL PRIMARY KEY,
    meal_name VARCHAR(150) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- REÇETE İÇERİKLERİ
CREATE TABLE recipe_ingredients (
    id SERIAL PRIMARY KEY,
    recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id),
    quantity_per_portion NUMERIC(10,4) NOT NULL
);

-- HAFTALIK MENÜ PROGRAMI
CREATE TABLE weekly_menu (
    id SERIAL PRIMARY KEY,
    day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 1 AND 7), -- 1=Pazartesi
    recipe_id INTEGER NOT NULL REFERENCES recipes(id),
    valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
    valid_to DATE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- GÜNLÜK YEMEK PLANI (fiili pişirim kaydı)
CREATE TABLE meal_plans (
    id SERIAL PRIMARY KEY,
    plan_date DATE NOT NULL,
    recipe_id INTEGER NOT NULL REFERENCES recipes(id),
    portion_count INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- YEMEK GERİ BİLDİRİMİ
CREATE TABLE meal_feedback (
    id SERIAL PRIMARY KEY,
    feedback_date DATE NOT NULL,
    recipe_id INTEGER NOT NULL REFERENCES recipes(id),
    feedback_level VARCHAR(10) NOT NULL CHECK (feedback_level IN ('az','normal','cok')),
    created_at TIMESTAMP DEFAULT NOW()
);

-- STOK HAREKETLERİ
CREATE TABLE stock_transactions (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id),
    transaction_type VARCHAR(10) NOT NULL CHECK (transaction_type IN ('in','out','waste')),
    quantity NUMERIC(10,4) NOT NULL,
    source_type VARCHAR(20) NOT NULL, -- 'invoice' | 'meal_plan' | 'manual' | 'voice'
    source_id INTEGER,
    transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- GÜNCEL STOK
CREATE TABLE current_stock (
    product_id INTEGER PRIMARY KEY REFERENCES products(id),
    quantity NUMERIC(12,4) NOT NULL DEFAULT 0,
    last_updated TIMESTAMP DEFAULT NOW()
);

-- STOĞU OTOMATİK GÜNCELLEYEN TRIGGER
CREATE OR REPLACE FUNCTION update_current_stock() RETURNS TRIGGER AS $$
BEGIN
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
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_stock
AFTER INSERT ON stock_transactions
FOR EACH ROW EXECUTE FUNCTION update_current_stock();
```

## 4. Anahtar sorgular

**Bugünün yemeğini bul:**
```sql
SELECT r.* FROM weekly_menu wm
JOIN recipes r ON r.id = wm.recipe_id
WHERE wm.day_of_week = EXTRACT(ISODOW FROM CURRENT_DATE)
  AND wm.valid_from <= CURRENT_DATE
  AND (wm.valid_to IS NULL OR wm.valid_to >= CURRENT_DATE);
```

**Kritik stoktaki ürünler:**
```sql
SELECT p.name, cs.quantity, p.critical_threshold
FROM current_stock cs
JOIN products p ON p.id = cs.product_id
WHERE cs.quantity <= p.critical_threshold;
```

**Son 5 pişirilişin 3'ünde "az yenildi" alan yemekler:**
```sql
WITH last5 AS (
  SELECT recipe_id, feedback_level,
         ROW_NUMBER() OVER (PARTITION BY recipe_id ORDER BY feedback_date DESC) AS rn
  FROM meal_feedback
)
SELECT recipe_id, COUNT(*) FILTER (WHERE feedback_level = 'az') AS az_sayisi
FROM last5 WHERE rn <= 5
GROUP BY recipe_id
HAVING COUNT(*) FILTER (WHERE feedback_level = 'az') >= 3;
```

## 5. Antigravity ile geliştirme adımları

1. Proje klasörünü hazırla, bu belgeyi ve şemayı referans dosya olarak koy.
2. Veritabanını kurdur (Supabase veya Docker ile PostgreSQL, yukarıdaki şemayla).
3. Backend modülünü yazdır: ürün/stok/tüketim API uçları — küçük parçalar halinde ilerle.
4. Panel (arayüz) modülünü yazdır: Stok Durumu, Ürünler/Reçeteler, sabah öğrenci sayısı girişi, akşam rapor ekranı.
5. AI özelliklerini ekletir: fatura fotoğrafı analizi (vision), sesli komut — en karmaşık kısım olduğu için en sona bırak.
6. Yayına al (Vercel/Railway gibi bir servise deploy).

## 6. n8n ile otomasyon adımları

1. n8n hesabını hazırla, Antigravity'nin kurduğu veritabanına bağlan.
2. Fatura fotoğrafı akışı: Telegram/Webhook → Claude API (vision) → Postgres'e yaz.
3. Sesli komut akışı: ses girişi → metne çevir → Claude API ile ürün/miktar çıkar → Postgres'e yaz.
4. Günlük otomatik akış: her akşam zamanlanmış → weekly_menu + öğrenci sayısı oku → tüketimi hesapla → stok güncelle → kritik kontrol → bildirim.
5. Akşam raporu akışı: günün verisini Claude API'ye ver, özet + öneri ürettir, gönder.
6. Haftalık/aylık rapor akışı: azalan/artan/durgun ürünler + popülerlik + protein ortalaması → özet rapor.
7. Her akışı ayrı ayrı kur ve test et, hepsini aynı anda kurmaya çalışma.

## 7. Antigravity'ye verilecek ilk prompt (kopyala-yapıştır)

> Anaokulu yemekhanesi için bir stok takip ve otomasyon sistemi geliştiriyorum. Ekte verdiğim PostgreSQL şemasını kullanarak önce veritabanını kur (Supabase veya Docker ile). Sistemin mantığı: personel sabah öğrenci sayısını girecek, sistem haftalık menüden bugünün yemeğini bulup reçeteye göre stoktan otomatik düşecek, akşam da özet rapor üretecek. Şimdilik sadece veritabanı kurulumunu yap, bitirince bana haber ver — sonraki adımda backend API'lerini birlikte yazacağız.
