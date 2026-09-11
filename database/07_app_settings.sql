-- ============================================================
-- SİSTEM AYARLARI TABLOSU (app_settings)
-- Hedef Yaş Grubu, Okul Adı ve Genel Ayarlar
-- ============================================================

CREATE TABLE IF NOT EXISTS app_settings (
    key VARCHAR(50) PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Hedef Yaş Grubunu '2-6 Yaş Grubu' olarak ekle/güncelle
INSERT INTO app_settings (key, value, description)
VALUES ('target_age_group', '2-6 Yaş Grubu', 'Okul yemekhanesi hedef öğrenci yaş grubu tanımı')
ON CONFLICT (key) DO UPDATE 
SET value = EXCLUDED.value, updated_at = NOW();

INSERT INTO app_settings (key, value, description)
VALUES ('school_name', 'Anaokulu', 'Okul veya kurum adı')
ON CONFLICT (key) DO UPDATE 
SET value = EXCLUDED.value, updated_at = NOW();
