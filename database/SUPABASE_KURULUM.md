# Supabase Kurulum Rehberi — Anaokulu Stok Takip Sistemi

## Adım 1 — Supabase Projesi Oluştur

1. https://supabase.com adresine git, ücretsiz hesap oluştur (GitHub ile kolay)
2. **New Project** tıkla
3. Ayarlar:
   - **Name:** `anaokulu-stok`
   - **Database Password:** Güçlü bir şifre seç ve bir yere kaydet
   - **Region:** `West EU (Ireland)` veya `Central EU (Frankfurt)` seç — Türkiye'ye en yakın
4. **Create new project** tıkla, ~1-2 dk bekle (proje hazırlanıyor)

---

## Adım 2 — Şemayı Uygula

1. Sol menüden **SQL Editor** aç
2. **New query** tıkla
3. `database/01_schema.sql` dosyasının tüm içeriğini kopyala ve yapıştır
4. **Run (F5)** tıkla → "Success. No rows returned" mesajı görmelisin
5. Sol menüden **Table Editor** aç → 11 tablonun oluştuğunu doğrula:
   - products, suppliers, invoices, invoice_items
   - recipes, recipe_ingredients
   - weekly_menu, meal_plans, meal_feedback
   - stock_transactions, current_stock

---

## Adım 3 — Örnek Veriyi Yükle

1. SQL Editor'da yeni bir query aç
2. `database/02_seed_data.sql` dosyasının içeriğini kopyala ve yapıştır
3. **Run** tıkla
4. Doğrulamak için şu sorguyu çalıştır:

```sql
-- Stok durumu kontrolü
SELECT p.name, p.unit, cs.quantity, p.critical_threshold
FROM current_stock cs
JOIN products p ON p.id = cs.product_id
ORDER BY p.category, p.name;

-- Bugünün menüsü
SELECT r.meal_name
FROM weekly_menu wm
JOIN recipes r ON r.id = wm.recipe_id
WHERE wm.day_of_week = EXTRACT(ISODOW FROM CURRENT_DATE)
  AND wm.valid_from <= CURRENT_DATE
  AND (wm.valid_to IS NULL OR wm.valid_to >= CURRENT_DATE);
```

---

## Adım 4 — Bağlantı Bilgilerini Al

1. Sol menüden **Settings → Database** aç
2. "Connection string" bölümünden **URI** formatını kopyala:
   ```
   postgresql://postgres:[YOUR_PASSWORD]@db.xxxxxxxxxxxx.supabase.co:5432/postgres
   ```
3. Bu URI'yi `.env` dosyasında tutacağız (backend adımında kullanılacak)

### Supabase API (REST / SDK için)
- **Settings → API** bölümünde:
  - **Project URL:** `https://xxxxxxxxxxxx.supabase.co`
  - **anon public key:** backend ve n8n için kullanılacak
  - **service_role key:** sadece backend sunucusunda kullanılacak (gizli tut!)

---

## Adım 5 — Row Level Security (RLS)

Supabase varsayılan olarak RLS aktif gelir. Şimdilik hızlı test için:

```sql
-- GELİŞTİRME AŞAMASINDA geçici olarak tüm tablolara erişim aç
-- (ÜRETİM'de asla bu şekilde bırakma!)
ALTER TABLE products DISABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers DISABLE ROW LEVEL SECURITY;
ALTER TABLE invoices DISABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE recipes DISABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_ingredients DISABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_menu DISABLE ROW LEVEL SECURITY;
ALTER TABLE meal_plans DISABLE ROW LEVEL SECURITY;
ALTER TABLE meal_feedback DISABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE current_stock DISABLE ROW LEVEL SECURITY;
```

---

## Kullanışlı Doğrulama Sorguları

```sql
-- Kritik stok uyarısı (şu an yok, örnek için kritik_threshold'u test edebilirsin)
SELECT p.name, cs.quantity, p.critical_threshold
FROM current_stock cs JOIN products p ON p.id = cs.product_id
WHERE cs.quantity <= p.critical_threshold;

-- Bir reçetenin porsiyon başı protein değeri (örn. Tavuk Sote = id:3)
SELECT r.meal_name,
       SUM(ri.quantity_per_portion * p.protein_per_unit) AS protein_g_per_portion
FROM recipe_ingredients ri
JOIN products p ON p.id = ri.product_id
JOIN recipes r ON r.id = ri.recipe_id
WHERE ri.recipe_id = 3
GROUP BY r.meal_name;

-- Mercimek Çorbası popülerlik durumu (3 kez "az" => öneri motoruna girer)
WITH last5 AS (
  SELECT recipe_id, feedback_level,
         ROW_NUMBER() OVER (PARTITION BY recipe_id ORDER BY feedback_date DESC) AS rn
  FROM meal_feedback
)
SELECT r.meal_name,
       COUNT(*) FILTER (WHERE l.feedback_level = 'az') AS az_sayisi
FROM last5 l JOIN recipes r ON r.id = l.recipe_id
WHERE l.rn <= 5
GROUP BY r.meal_name
HAVING COUNT(*) FILTER (WHERE l.feedback_level = 'az') >= 3;
```

---

## Sonraki Adım: Backend API

Veritabanı kurulunca şu endpoint'leri birlikte yazacağız:

| Method | Endpoint                      | Açıklama                                         |
|--------|-------------------------------|--------------------------------------------------|
| POST   | `/api/daily-consumption`      | Öğrenci sayısı gir → stok otomatik düşsün        |
| GET    | `/api/today-menu`             | Bugünün yemeğini getir (weekly_menu'den)         |
| GET    | `/api/stock-status`           | Güncel stok + kritik uyarılar                    |
| POST   | `/api/meal-feedback`          | Öğle sonrası geri bildirim gir                   |
| GET    | `/api/evening-report`         | Günlük özet rapor (AI destekli)                  |
| POST   | `/api/invoice`                | Fatura ekle (manual / OCR / voice)               |
