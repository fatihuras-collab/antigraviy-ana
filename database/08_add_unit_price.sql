-- ============================================================
-- MİGRASYON 08: products tablosuna unit_price (alış fiyatı) ekle
-- ============================================================

ALTER TABLE products ADD COLUMN IF NOT EXISTS unit_price NUMERIC(10,2);

COMMENT ON COLUMN products.unit_price IS 'Ürünün 1 biriminin güncel TL cinsinden alış fiyatı (1 kg, 1 lt veya 1 adet)';
