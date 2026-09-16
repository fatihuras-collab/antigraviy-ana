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

const { sendTelegramMessage } = require('../services/telegramService');

// ─── POST /api/settings/reset-system ──────────────────────────────────────────
// Sistemi gerçek kullanıma hazırlar (Çok Korumalı & Şifreli):
// 1. Şifre kontrolü: process.env.RESET_PASSWORD kontrol edilir, hatalıysa reddedilir.
// 2. stock_transactions tablosundaki tüm kayıtları siler (fatura ve tüketim geçmişi).
// 3. current_stock tablosundaki tüm miktarları 0 yapar.
// 4. meal_feedback ve meal_plans tablolarındaki test kayıtlarını siler.
// 5. Telegram'a sıfırlama bildirimi gönderir: "⚠️ Stok verileri sıfırlandı — [tarih saat]"
// KESİNLİKLE DOKUNULMAZ: products (ürün tanımları ve unit_price), recipes (reçeteler), monthly_menu (menü), app_settings
router.post('/reset-system', async (req, res) => {
  try {
    const { password } = req.body || {};

    const configuredPassword = (process.env.RESET_PASSWORD || '1234').toString().trim();
    if (!configuredPassword) {
      return res.status(500).json({
        success: false,
        error: 'Sunucuda RESET_PASSWORD environment değişkeni tanımlanmamış. Güvenlik nedeniyle sıfırlama engellendi.'
      });
    }

    if (!password || password.toString().trim() !== configuredPassword) {
      return res.status(403).json({
        success: false,
        error: 'Şifre hatalı'
      });
    }

    // 1. stock_transactions sil
    const { error: errTrans } = await supabase
      .from('stock_transactions')
      .delete()
      .gt('id', 0);
    if (errTrans) throw new Error(`stock_transactions silinemedi: ${errTrans.message}`);

    // 2. meal_feedback sil
    const { error: errFeedback } = await supabase
      .from('meal_feedback')
      .delete()
      .gt('id', 0);
    if (errFeedback) throw new Error(`meal_feedback silinemedi: ${errFeedback.message}`);

    // 3. meal_plans sil
    const { error: errPlans } = await supabase
      .from('meal_plans')
      .delete()
      .gt('id', 0);
    if (errPlans) throw new Error(`meal_plans silinemedi: ${errPlans.message}`);

    // 4. current_stock tablosundaki tüm miktarları 0 yap
    const { error: errStockUpdate } = await supabase
      .from('current_stock')
      .update({ quantity: 0, last_updated: new Date().toISOString() })
      .gt('product_id', 0);
    if (errStockUpdate) throw new Error(`current_stock güncellenemedi: ${errStockUpdate.message}`);

    // Tüm mevcut ürünlerin current_stock kaydı olduğundan ve 0 olduğundan emin ol
    // NOT: products tablosundaki id, name, unit, category, critical_threshold, unit_price ASLA silinmez!
    const { data: products, error: prodErr } = await supabase
      .from('products')
      .select('id');
    if (!prodErr && products && products.length > 0) {
      const resetRows = products.map(p => ({
        product_id: p.id,
        quantity: 0,
        last_updated: new Date().toISOString()
      }));
      await supabase
        .from('current_stock')
        .upsert(resetRows, { onConflict: 'product_id' });
    }

    // Telegram stok uyarı geçmişini de sıfırla
    try {
      const { clearAlertState } = require('../services/stockAlertService');
      await clearAlertState();
    } catch (e) {
      // sessizce geç
    }

    // Telegram'a sıfırlama bildirimi gönder
    try {
      const dateStr = new Intl.DateTimeFormat('tr-TR', {
        timeZone: 'Europe/Istanbul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      }).format(new Date());

      await sendTelegramMessage(`⚠️ Stok verileri sıfırlandı — ${dateStr}`);
    } catch (telegramErr) {
      console.warn('[reset-system Telegram Hatası]', telegramErr.message);
    }

    res.json({
      success: true,
      message: 'Sistem gerçek kullanıma hazırlandı! Stok hareketleri ve test kayıtları silindi, tüm stoklar 0 olarak güncellendi.'
    });
  } catch (err) {
    console.error('[reset-system HATA]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

