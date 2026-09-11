-- ============================================================
-- MİGRASYON 04: recipes tablosuna is_draft alanı ekle
-- ============================================================

ALTER TABLE recipes ADD COLUMN IF NOT EXISTS is_draft BOOLEAN NOT NULL DEFAULT false;

-- Mevcut reçeteler yayınlanmış kabul edilir (false = yayında)
-- İsteğe bağlı: belirli reçeteleri taslağa almak için:
-- UPDATE recipes SET is_draft = true WHERE id = X;

COMMENT ON COLUMN recipes.is_draft IS 'true = taslak (henüz menüye eklenmeye hazır değil), false = yayında';
