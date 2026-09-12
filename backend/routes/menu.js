/**
 * MENÜ YÜKLEME ROUTE'LARI
 *
 * POST /api/menu/parse  — Görsel/PDF'i Claude AI ile parse eder, JSON döner (DB'ye yazmaz)
 * POST /api/menu/save   — Parse edilmiş menüyü monthly_menu tablosuna upsert eder
 * GET  /api/menu/check-recipes — Belirtilen yemek listesinde reçetesi olmayanları bildirir
 */

const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const https   = require('https');
const supabase = require('../supabase');

// ── Multer: bellek'e al (disk'e yazma) ──────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 20 * 1024 * 1024 }, // 20 MB maks.
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Sadece JPG, PNG, WebP, GIF veya PDF dosyası yüklenebilir.'));
    }
  }
});

// ── Türkçe gün adları ─────────────────────────────────────────────────────────
const GUN_ADLARI = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

// ── Haftanın ilk pazartesisini bul ──────────────────────────────────────────
function ilkPazartesi(yil, ay) {
  // ay: 1-12
  const d = new Date(yil, ay - 1, 1);
  // getDay(): 0=Pazar, 1=Pzt
  const dow = d.getDay();
  const offset = dow === 1 ? 0 : (dow === 0 ? 1 : 8 - dow);
  d.setDate(d.getDate() + offset);
  return d;
}

// ── Tarihi YYYY-MM-DD formatına çevir ──────────────────────────────────────
function toDateStr(d) {
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

// ── Claude API'yi doğrudan HTTPS ile çağır ──────────────────────────────────
function callClaude(base64Data, mediaType, promptText) {
  const apiKey = (process.env.ANTHROPIC_API_KEY || '').trim();
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY ortam değişkeni tanımlı değil.');

  const bodyPayload = {
    model: 'claude-sonnet-4-6',
    max_tokens: 8192,
    messages: [
      {
        role: 'user',
        content: [
          {
            type:  'image',
            source: {
              type:       'base64',
              media_type: mediaType,
              data:       base64Data
            }
          },
          {
            type: 'text',
            text: promptText
          }
        ]
      }
    ]
  };

  const bodyStr = JSON.stringify(bodyPayload);

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.anthropic.com',
      path:     '/v1/messages',
      method:   'POST',
      headers: {
        'Content-Type':      'application/json',
        'Content-Length':    Buffer.byteLength(bodyStr),
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 400) {
            return reject(new Error(`Claude API hata ${res.statusCode}: ${JSON.stringify(parsed)}`));
          }
          resolve(parsed);
        } catch (e) {
          reject(new Error(`Claude API yanıtı parse edilemedi: ${data.slice(0, 200)}`));
        }
      });
    });

    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

// ── POST /api/menu/parse ──────────────────────────────────────────────────────
// Form-data alanları: file (dosya), month (1-12), year (YYYY)
router.post('/parse', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Dosya (file) zorunludur.' });
    }

    const month = parseInt(req.body.month, 10);
    const year  = parseInt(req.body.year,  10);

    if (!month || month < 1 || month > 12 || !year || year < 2020 || year > 2100) {
      return res.status(400).json({ success: false, error: 'Geçerli bir month (1-12) ve year girilmelidir.' });
    }

    // PDF için özel işlem: PDF'i resim olarak gönderemeyiz Claude'a doğrudan.
    // Kullanıcıya uyarı ver.
    if (req.file.mimetype === 'application/pdf') {
      return res.status(415).json({
        success: false,
        error: 'PDF dosyaları henüz desteklenmiyor. Lütfen menü görselini JPG veya PNG olarak yükleyin.'
      });
    }

    const base64Data = req.file.buffer.toString('base64');
    const mediaType  = req.file.mimetype; // 'image/jpeg' | 'image/png' | 'image/webp'

    // İlk Pazartesi hesabı (taslak tarih için)
    const ilkPzt = ilkPazartesi(year, month);

    const promptText = `Sen bir anaokulu yemekhane menüsünü okuyan bir asistansın.

Bu görseldeki yemek listesini/menüyü analiz et.

Kurallar:
1. Sadece hafta içi günleri (Pazartesi-Cuma) listele. Hafta sonlarını atlayarak devam et.
2. Her güne 3 öğün: kahvalti (sabah), ogle (öğle), ikindi (ikindi kahvaltısı)
3. Her öğün bir veya birden fazla yemek adı içerebilir; bunları dizi olarak ver.
4. Eğer görselde gerçek tarihler (YYYY-MM-DD veya DD.MM.YYYY formatında) yazıyorsa, onları YYYY-MM-DD olarak kullan.
5. Eğer görselde sadece "1. Hafta Pazartesi" gibi etiketler varsa, ${year} yılı ${month}. ayının ilk pazartesisi ${toDateStr(ilkPzt)} tarihinden başlayarak hesapla ve her gün +1 gün ekle (hafta sonlarını atlayarak).
6. Yemek adlarını görselde yazdığı gibi koru, çeviri yapma, kısaltma.
7. Sadece aşağıdaki JSON formatını döndür, başka hiçbir şey yazma — ne açıklama, ne markdown, ne ek metin.

{
  "gunler": [
    {
      "tarih": "YYYY-MM-DD",
      "kahvalti": ["yemek adı 1", "yemek adı 2"],
      "ogle": ["yemek adı 1"],
      "ikindi": ["yemek adı 1"]
    }
  ]
}`;

    console.log(`[MENU PARSE] ${req.file.originalname} (${req.file.mimetype}, ${req.file.size} byte) → Claude'a gönderiliyor...`);

    const claudeResp = await callClaude(base64Data, mediaType, promptText);

    const rawText = claudeResp?.content?.[0]?.text || '';
    console.log('[MENU PARSE] Claude ham yanıt (ilk 400 karakter):', rawText.slice(0, 400));

    // JSON çıkar (bazen Claude ``` bloğu içinde verebilir)
    let jsonText = rawText.trim();
    const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) jsonText = jsonMatch[1].trim();

    let parsed;
    try {
      parsed = JSON.parse(jsonText);
    } catch (e) {
      return res.status(422).json({
        success: false,
        error: `Claude geçerli JSON döndürmedi. Ham yanıt: ${rawText.slice(0, 300)}`
      });
    }

    if (!parsed.gunler || !Array.isArray(parsed.gunler)) {
      return res.status(422).json({
        success: false,
        error: '"gunler" dizisi bulunamadı. Claude yanıtı: ' + rawText.slice(0, 300)
      });
    }

    // Verileri temizle ve doğrula
    const HAFTA_SONU = [0, 6]; // Pazar=0, Cumartesi=6
    const temizGunler = parsed.gunler
      .filter(g => g.tarih && g.tarih.match(/^\d{4}-\d{2}-\d{2}$/))
      .filter(g => {
        const dow = new Date(g.tarih + 'T12:00:00').getDay();
        return !HAFTA_SONU.includes(dow);
      })
      .map(g => {
        const d   = new Date(g.tarih + 'T12:00:00');
        const dow = d.getDay();
        return {
          tarih:    g.tarih,
          gun_adi:  GUN_ADLARI[dow],
          kahvalti: Array.isArray(g.kahvalti) ? g.kahvalti.filter(Boolean) : [],
          ogle:     Array.isArray(g.ogle)     ? g.ogle.filter(Boolean)     : [],
          ikindi:   Array.isArray(g.ikindi)   ? g.ikindi.filter(Boolean)   : []
        };
      });

    if (temizGunler.length === 0) {
      return res.status(422).json({
        success: false,
        error: 'Menüde geçerli hafta içi gün bulunamadı. Lütfen görseli kontrol edin.'
      });
    }

    res.json({
      success:   true,
      gun_sayisi: temizGunler.length,
      ay:        month,
      yil:       year,
      gunler:    temizGunler
    });

  } catch (err) {
    console.error('[POST /api/menu/parse HATA]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /api/menu/save ───────────────────────────────────────────────────────
// Body: { gunler: [{ tarih, kahvalti: [...], ogle: [...], ikindi: [...] }] }
// Her yemek adı için recipes tablosunda eşleşme ara; varsa recipe_id kullan,
// yoksa is_draft=true ile yeni reçete oluştur, sonra monthly_menu'ye upsert yap.
router.post('/save', async (req, res) => {
  try {
    const { gunler } = req.body;

    if (!Array.isArray(gunler) || gunler.length === 0) {
      return res.status(400).json({ success: false, error: '"gunler" dizisi zorunludur.' });
    }

    // 1. Mevcut tüm reçeteleri çek
    const { data: tumReceteler, error: rErr } = await supabase
      .from('recipes')
      .select('id, meal_name, meal_type');
    if (rErr) throw rErr;

    // Hızlı arama için map: "meal_name::meal_type" → id
    const receteMap = {};
    for (const r of (tumReceteler || [])) {
      receteMap[`${r.meal_name}::${r.meal_type}`] = r.id;
    }

    // Reçete adını normalize et (büyük/küçük, trim)
    function normAd(str) {
      return (str || '').trim().toLowerCase();
    }

    // İsim bazlı gevşek arama (meal_type ile birlikte)
    function receteIdBul(ad, mealType) {
      const key = `${ad}::${mealType}`;
      if (receteMap[key]) return receteMap[key];
      // Büyük/küçük harf toleranslı
      for (const [k, v] of Object.entries(receteMap)) {
        const [kAd, kType] = k.split('::');
        if (kType === mealType && normAd(kAd) === normAd(ad)) return v;
      }
      return null;
    }

    // Yemek adı → recipe_id çözücü (yoksa oluşturur)
    const yeniOlusturulanlar = [];
    async function receteIdGetirVeyaOlustur(ad, mealType) {
      let rid = receteIdBul(ad, mealType);
      if (rid) return rid;

      // Yoksa is_draft=true ile oluştur
      const { data: yeni, error: yErr } = await supabase
        .from('recipes')
        .insert([{ meal_name: ad.trim(), meal_type: mealType, is_draft: true }])
        .select('id')
        .single();
      if (yErr) throw yErr;

      rid = yeni.id;
      receteMap[`${ad.trim()}::${mealType}`] = rid;
      yeniOlusturulanlar.push({ ad: ad.trim(), meal_type: mealType, recipe_id: rid });
      return rid;
    }

    // 2. Her gün için monthly_menu satırlarını hazırla (upsert)
    const upsertRows = [];
    const HAFTA_SONU = [0, 6];

    for (const gun of gunler) {
      const { tarih, kahvalti, ogle, ikindi } = gun;

      if (!tarih || !tarih.match(/^\d{4}-\d{2}-\d{2}$/)) continue;

      const d   = new Date(tarih + 'T12:00:00');
      const dow = d.getDay();  // 0=Pazar
      if (HAFTA_SONU.includes(dow)) continue;

      // getDay(): 0=Pazar, 1=Pzt… → DB'de day_of_week 1=Pzt, 2=Salı…, 5=Cuma
      const dbDow = dow; // 1=Pzt, 2=Salı, 3=Çar, 4=Per, 5=Cuma

      // Hafta numarasını tarihten hesapla (ayın ilk pazartesine göre 1-4)
      const yil   = d.getFullYear();
      const ayNo  = d.getMonth() + 1;
      const ilkPzt = ilkPazartesi(yil, ayNo);
      const fark   = Math.round((d - ilkPzt) / (1000 * 60 * 60 * 24));
      const weekNo  = Math.floor(fark / 7) + 1;

      const oguns = [
        { tip: 'kahvalti', yemekler: Array.isArray(kahvalti) ? kahvalti.filter(Boolean) : [] },
        { tip: 'ogle',     yemekler: Array.isArray(ogle)     ? ogle.filter(Boolean)     : [] },
        { tip: 'ikindi',   yemekler: Array.isArray(ikindi)   ? ikindi.filter(Boolean)   : [] }
      ];

      for (const { tip, yemekler } of oguns) {
        if (yemekler.length === 0) continue;
        // Birden fazla yemek varsa birleştir (virgülle)
        const bilesikAd = yemekler.join(', ');
        const rid = await receteIdGetirVeyaOlustur(bilesikAd, tip);

        upsertRows.push({
          date:        tarih,
          day_of_week: dbDow,
          week_number: Math.min(Math.max(weekNo, 1), 4),
          meal_type:   tip,
          recipe_id:   rid
        });
      }
    }

    if (upsertRows.length === 0) {
      return res.status(400).json({ success: false, error: 'Kaydedilecek geçerli menü satırı yok.' });
    }

    // 3. Upsert (date + meal_type unique)
    const { data: savedRows, error: uErr } = await supabase
      .from('monthly_menu')
      .upsert(upsertRows, { onConflict: 'date,meal_type' })
      .select();

    if (uErr) throw uErr;

    // 4. Reçetesi olmayan yemekler (is_draft=true olan yeni oluşturulanlar)
    const recetesizler = yeniOlusturulanlar.map(y => y.ad);

    res.status(201).json({
      success:         true,
      message:         `${savedRows?.length ?? upsertRows.length} menü satırı kaydedildi.`,
      kaydedilen:      savedRows?.length ?? upsertRows.length,
      yeni_tarif_sayisi: yeniOlusturulanlar.length,
      recetesiz_yemekler: recetesizler
    });

  } catch (err) {
    console.error('[POST /api/menu/save HATA]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
