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

// ── Frontend statik dosyaları sun (http://localhost:3000) ───────────────────
app.use(express.static(path.join(__dirname, '../frontend')));

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
app.use('/api/meal-feedback',      require('./routes/feedback'));
app.use('/api/recipes',            require('./routes/recipes'));
app.use('/api/settings',           require('./routes/settings'));

// ── 404 yakalayıcı ───────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Endpoint bulunamadı.' });
});

// ── Global hata yakalayıcı ───────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('[HATA]', err);
  res.status(500).json({ success: false, error: err.message });
});

// ── Sunucuyu başlat ──────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
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
  console.log(`   Geri bildirim       : POST /api/meal-feedback`);
  console.log(`   Bugünün öğünleri    : GET  /api/meal-feedback/today`);
  console.log(`   Reçete listesi      : GET  /api/recipes`);
  console.log(`   Reçete ekle         : POST /api/recipes`);
  console.log(`======================================================\n`);
});
