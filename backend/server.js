/**
 * Anaokulu Yemekhane Stok Takip Sistemi — Backend API
 * =====================================================
 * Mevcut endpoint'ler:
 *   GET    /api/products          — Ürün listesi (category filtreli)
 *   GET    /api/products/:id      — Tekil ürün
 *   POST   /api/products          — Ürün ekle
 *   DELETE /api/products/:id      — Ürün sil
 *
 *   POST   /api/stock/in          — Stok girişi
 *   GET    /api/stock/current     — Güncel stok (critical filtreli)
 */

const fs   = require('fs');
const path = require('path');

// ── Yerel ortamda .env varsa yükle (Railway/Cloud ortamlarında process.env doğrudan kullanılır)
const rootEnv = path.join(__dirname, '../.env');
const localEnv = path.join(__dirname, '.env');
if (fs.existsSync(rootEnv)) {
  require('dotenv').config({ path: rootEnv });
} else if (fs.existsSync(localEnv)) {
  require('dotenv').config({ path: localEnv });
}

const express = require('express');
const app     = express();

// ── CORS middleware ─────────────────────────────────────────────────────────
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.use(express.json());

// ── Frontend statik dosyaları sun (Kök adreste / panel açılır) ──────────────
const candidateDirs = [
  path.join(__dirname, 'public'),
  path.join(__dirname, 'frontend'),
  path.join(__dirname, '../frontend')
];

const frontendDir = candidateDirs.find(dir => fs.existsSync(path.join(dir, 'index.html'))) || path.join(__dirname, 'public');

console.log(`📁 Statik frontend dizini: ${frontendDir}`);

// Statik varlıkları sun (index.html, style.css, app.js vb.)
app.use(express.static(frontendDir));

// Kök adres (/) için index.html'i açıkça sun
app.get('/', (_req, res) => {
  const indexPath = path.join(frontendDir, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).json({ success: false, error: 'Frontend index.html bulunamadı.' });
  }
});

// ── Sağlık kontrolü ──────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    status:  'ok',
    service: 'Anaokulu Stok API',
    time:    new Date().toISOString()
  });
});

// ── Route'ları bağla ─────────────────────────────────────────────────────────
app.use('/api/products',           require('./routes/products'));
app.use('/api/stock',              require('./routes/stock'));
app.use('/api/daily-consumption',  require('./routes/consumption'));
app.use('/api/evening-report',     require('./routes/reports'));
app.use('/api/weekly-report',      require('./routes/weeklyReport'));
app.use('/api/meal-feedback',      require('./routes/feedback'));
app.use('/api/recipes',            require('./routes/recipes'));
app.use('/api/settings',           require('./routes/settings'));
app.use('/api/menu',               require('./routes/menu'));
app.use('/api/analytics',          require('./routes/analytics'));

// ── 404 yakalayıcı ───────────────────────────────────────────────────────────
app.use((req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ success: false, error: 'Endpoint bulunamadı.' });
  }

  // GET isteklerinde index.html fallback (SPA yönlendirmesi için)
  if (req.method === 'GET') {
    const indexPath = path.join(frontendDir, 'index.html');
    if (fs.existsSync(indexPath)) {
      return res.sendFile(indexPath);
    }
  }

  res.status(404).json({ success: false, error: 'Endpoint bulunamadı.' });
});

// ── Global hata yakalayıcı ───────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('[HATA]', err);
  res.status(500).json({ success: false, error: err.message });
});

// ── Sunucuyu başlat ──────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`\n======================================================`);
  console.log(`✅ Anaokulu Stok Takip & Tüketim Sistemi Yayında!`);
  console.log(`🌐 Web Paneli (Arayüz) : http://localhost:${PORT}`);
  console.log(`------------------------------------------------------`);
  console.log(`   Sağlık kontrolü     : GET  /health`);
  console.log(`   Ürün listesi        : GET  /api/products`);
  console.log(`   Ürün ekle           : POST /api/products`);
  console.log(`   Stok girişi         : POST /api/stock/in`);
  console.log(`   Güncel stok         : GET  /api/stock/current`);
  console.log(`   Kritik stok         : GET  /api/stock/current?critical=true`);
  console.log(`   Günlük tüketim      : POST /api/daily-consumption`);
  console.log(`   Akşam raporu        : GET  /api/evening-report`);
  console.log(`   Akşam raporu gönder : GET  /api/evening-report/send`);
  console.log(`   Haftalık rapor      : GET  /api/weekly-report`);
  console.log(`   Haftalık rapor gönd.: GET  /api/weekly-report/send`);
  console.log(`   Geri bildirim       : POST /api/meal-feedback`);
  console.log(`   Bugünün öğünleri    : GET  /api/meal-feedback/today`);
  console.log(`   Reçete listesi      : GET  /api/recipes`);
  console.log(`   Reçete ekle         : POST /api/recipes`);
  console.log(`   Menü parse (AI)     : POST /api/menu/parse`);
  console.log(`   Menü kaydet         : POST /api/menu/save`);
  console.log(`   Analiz verisi       : GET  /api/analytics/summary`);
  console.log(`   Uygulama ayarları   : GET  /api/settings`);
  console.log(`   Sistem sıfırlama    : POST /api/settings/reset-system`);

  const hasTelegramToken = !!process.env.TELEGRAM_BOT_TOKEN;
  const hasTelegramChat  = !!process.env.TELEGRAM_CHAT_ID;
  console.log(`   Telegram Uyarısı    : ${hasTelegramToken && hasTelegramChat ? '✓ Aktif' : '⚠️ TELEGRAM_BOT_TOKEN veya TELEGRAM_CHAT_ID eksik'}`);
  console.log(`======================================================\n`);

  // Telegram stok uyarı durumunu başlat
  try {
    const { initAlertState } = require('./services/stockAlertService');
    initAlertState().catch(e => console.warn('[StockAlert Init]', e.message));
  } catch (e) {
    // sessizce geç
  }

  // Zamanlanmış görevleri (Her gün 18:00 otomatik akşam raporu) başlat
  try {
    const { initScheduler } = require('./services/schedulerService');
    initScheduler();
  } catch (e) {
    console.warn('[Scheduler Init]', e.message);
  }
});
