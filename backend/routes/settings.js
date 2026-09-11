const express = require('express');
const router  = express.Router();
const path    = require('path');
const fs      = require('fs');
const supabase = require('../supabase');

const LOCAL_SETTINGS_FILE = path.join(__dirname, '../settings.json');

// Varsayılan ayarlar
const DEFAULT_SETTINGS = {
  target_age_group: '2-6 Yaş Grubu',
  school_name: 'Anaokulu'
};

// Yardımcı: Yerel dosyadaki ayarları oku
function readLocalSettings() {
  try {
    if (fs.existsSync(LOCAL_SETTINGS_FILE)) {
      const content = fs.readFileSync(LOCAL_SETTINGS_FILE, 'utf-8');
      return { ...DEFAULT_SETTINGS, ...JSON.parse(content) };
    }
  } catch (e) {
    console.warn('[Yerel ayar okunamadı]', e.message);
  }
  return { ...DEFAULT_SETTINGS };
}

// Yardımcı: Yerel dosyaya yaz
function writeLocalSettings(data) {
  try {
    fs.writeFileSync(LOCAL_SETTINGS_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.warn('[Yerel ayar yazılamadı]', e.message);
  }
}

// ─── GET /api/settings ────────────────────────────────────────────────────────
// Tüm uygulama ayarlarını döndürür
router.get('/', async (_req, res) => {
  let settings = readLocalSettings();

  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('key, value, description');

    if (!error && data && data.length > 0) {
      data.forEach(item => {
        settings[item.key] = item.value;
      });
      // Yerel kopyayı güncelle
      writeLocalSettings(settings);
    }
  } catch (err) {
    // Supabase tablosu yoksa yerel ayar kullanılır
  }

  res.json({
    success: true,
    settings
  });
});

// ─── POST /api/settings ───────────────────────────────────────────────────────
// Ayar ekler veya günceller
// Body: { key, value, description? } VEYA { settings: { key: value, ... } }
router.post('/', async (req, res) => {
  try {
    const current = readLocalSettings();
    const updates = {};

    if (req.body.settings && typeof req.body.settings === 'object') {
      Object.assign(updates, req.body.settings);
    } else if (req.body.key && req.body.value !== undefined) {
      updates[req.body.key] = req.body.value;
    } else {
      return res.status(400).json({ success: false, error: 'Ayar anahtarı ve değeri gereklidir.' });
    }

    // Yerel dosyaya yaz
    Object.assign(current, updates);
    writeLocalSettings(current);

    // Supabase app_settings tablosuna yazmayı dene
    try {
      const upsertPayload = Object.entries(updates).map(([k, v]) => ({
        key: k,
        value: String(v),
        description: req.body.description || null,
        updated_at: new Date().toISOString()
      }));

      await supabase.from('app_settings').upsert(upsertPayload, { onConflict: 'key' });
    } catch (e) {
      // Tablo yoksa yerel dosya güncellenmiş durumda
    }

    res.json({
      success: true,
      message: 'Ayarlar başarıyla güncellendi.',
      settings: current
    });
  } catch (err) {
    console.error('[Ayar kaydetme hatası]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
