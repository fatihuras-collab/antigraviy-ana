/**
 * STOK ROUTE'LARI
 *
 * POST /api/stock/in      — Stok girişi ekle (stock_transactions 'in' kaydı)
 *                           Trigger otomatik olarak current_stock'u günceller.
 *
 * GET  /api/stock/current — Tüm ürünlerin güncel stok durumunu listele
 *                           Kritik seviyenin altındakileri is_critical=true ile işaretle.
 */

const express  = require('express');
const router   = express.Router();
const supabase = require('../supabase');
const { checkStockAlerts } = require('../services/stockAlertService');
const { getPrice, setPrice, parseNumericPrice } = require('../services/productPriceService');

// ─── Yardımcı Fonksiyonlar: Metin Normalizasyonu ve Akıllı Eşleştirme ──────
function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeTurkish(str) {
  if (!str) return '';
  return str
    .toString()
    .replace(/İ/g, 'i')
    .replace(/I/g, 'ı')
    .toLocaleLowerCase('tr-TR')
    .replace(/[^a-z0-9ğüşıöç\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function wordsMatch(w1, w2) {
  if (w1 === w2) return true;
  if (w1.length >= 4 && w2.length >= 4) {
    if (w1.startsWith(w2) || w2.startsWith(w1)) return true;
    if (w1.slice(0, 4) === w2.slice(0, 4)) return true;
  }
  if ((w1.length === 3 || w2.length === 3) && (w1.startsWith(w2) || w2.startsWith(w1))) {
    return true;
  }
  return false;
}

function findMatchingProduct(targetName, products) {
  const normTarget = normalizeTurkish(targetName);
  if (!normTarget || !products || products.length === 0) return null;

  const units = new Set(['kg', 'gr', 'g', 'lt', 'l', 'litre', 'adet', 'pkt', 'paket', 'koli']);
  const adjectives = new Set(['kuru', 'taze', 'sert', 'yumuşak', 'tatlı', 'acı', 'sıvı', 'organik', 'doğal', 'yerli', 'ithal', 'kırmızı', 'yeşil', 'beyaz', 'siyah', 'sarı']);

  const targetWords = normTarget.split(' ').filter(w => w.length >= 2 && !units.has(w) && isNaN(w));

  let bestMatch = null;
  let bestScore = 0;

  for (const product of products) {
    const normCand = normalizeTurkish(product.name);
    if (!normCand) continue;

    // 1. Birebir eşitlik
    if (normTarget === normCand) {
      return { product, score: 100000, type: 'exact' };
    }

    let score = 0;
    let matchType = '';

    const candInTarget = new RegExp('(^|\\s)' + escapeRegex(normCand) + '(\\s|$)').test(normTarget);
    const targetInCand = new RegExp('(^|\\s)' + escapeRegex(normTarget) + '(\\s|$)').test(normCand);

    // 2. Mevcut ürün adı aranan isimde tam geçiyor mu? (Örn: "Elma (Starking)" -> "Elma")
    if (candInTarget) {
      score = 50000 + (normCand.length * 100);
      matchType = 'phrase_contained';
    }
    // 3. Aranan isim mevcut ürünün içinde tam geçiyor mu? (Örn: "Elma" -> "Amasya Elma")
    else if (targetInCand) {
      score = 40000 + (normTarget.length * 100) - normCand.length;
      matchType = 'target_contained';
    } else {
      const candWords = normCand.split(' ').filter(w => w.length >= 2 && !units.has(w) && isNaN(w));
      const matchedCandWords = candWords.filter(cw => targetWords.some(tw => wordsMatch(cw, tw)));

      const nonAdjMatched = matchedCandWords.filter(w => !adjectives.has(w));

      if (matchedCandWords.length > 0 && (matchedCandWords.length > 1 || nonAdjMatched.length > 0)) {
        const allCandInTarget = candWords.every(cw => targetWords.some(tw => wordsMatch(cw, tw)));
        const allTargetInCand = targetWords.every(tw => candWords.some(cw => wordsMatch(tw, cw)));

        if (allCandInTarget) {
          // Örn: "Dana Kıyma" -> "Kıyma (dana)"
          score = 30000 + (candWords.length * 500);
          matchType = 'all_words';
        } else if (allTargetInCand) {
          score = 25000 + (targetWords.length * 500);
          matchType = 'all_target_words';
        } else {
          const ratio = matchedCandWords.length / Math.max(candWords.length, targetWords.length);
          if (ratio >= 0.5) {
            score = 10000 * ratio + (matchedCandWords.length * 200);
            matchType = 'partial_words';
          }
        }
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = { product, score, type: matchType };
    }
  }

  return bestScore >= 1000 ? bestMatch : null;
}

// ─── POST /api/stock/in ──────────────────────────────────────────────────────
// Zorunlu: product_id VEYA product_name (veya name), quantity
// Opsiyonel: unit (yeni ürün için varsayılan 'kg'), transaction_date (varsayılan: bugün), source_type (varsayılan: 'manual')
//
// Örnek body (ID ile):
// {
//   "product_id": 1,
//   "quantity": 10.5
// }
//
// Örnek body (n8n / Fatura - İsim ve Birim Fiyat ile):
// {
//   "product_name": "Elma (Starking)",
//   "quantity": 10,
//   "unit": "kg",
//   "birim_fiyat": 45.00,
//   "source_type": "invoice"
// }
// ─── POST /api/stock/in ──────────────────────────────────────────────────────
// Hem tek bir ürün nesnesini hem de dizi halindeki toplu fatura kalemlerini kabul eder.
//
// Desteklenen Alanlar (Esnek Eşleştirme):
// - İsim: product_name, name, urun_adi, urunAdi, ürün_adı
// - Miktar: quantity, miktar, adet, qty
// - Birim: unit, birim
// - Birim Fiyat: birim_fiyat, unit_price, fiyat, price
// - Toplam Tutar: toplam_tutar, total_amount, tutar (Birim fiyat yoksa toplam_tutar / miktar hesabı yapılır)
//
// Örnek Body:
// [
//   { "urun_adi": "Dana Kıyma", "miktar": 10, "birim": "kg", "birim_fiyat": 450.00 },
//   { "urun_adi": "Domates", "miktar": 20, "birim": "kg", "toplam_tutar": 650.00 }
// ]

async function processStockInItem(itemData) {
  // Ham AI verisini Railway loguna yaz
  console.log(`🤖 AI'dan gelen: ${JSON.stringify(itemData)}`);

  const searchedName = (
    itemData.ad ||
    itemData.urun_adi ||
    itemData.urunAdi ||
    itemData.ürün_adı ||
    itemData.urun ||
    itemData.ürün ||
    itemData.product_name ||
    itemData.name ||
    itemData.item_name ||
    itemData.title ||
    ''
  ).toString().trim();

  const productId = itemData.product_id || itemData.id || null;
  const rawQty = (
    itemData.miktar ??
    itemData.adet ??
    itemData.sayi ??
    itemData.quantity ??
    itemData.qty ??
    itemData.amount
  );
  const unit = (
    itemData.birim ||
    itemData.unit ||
    itemData.olcu_birimi ||
    itemData.olcuBirimi ||
    'kg'
  ).toString().trim().slice(0, 20);
  const category = (itemData.category || itemData.kategori || 'genel').toString().trim().slice(0, 80);
  const critical_threshold = itemData.critical_threshold ?? itemData.kritik_esik ?? null;
  const protein_per_unit = itemData.protein_per_unit ?? itemData.protein ?? null;
  const transaction_date = itemData.transaction_date || itemData.tarih || new Date().toISOString().split('T')[0];

  let resolvedSourceType = (itemData.source_type || itemData.kaynak || itemData.source || 'invoice').toString().toLowerCase().trim();
  if (resolvedSourceType === 'fatura') resolvedSourceType = 'invoice';
  if (resolvedSourceType === 'ses' || resolvedSourceType === 'sesli') resolvedSourceType = 'voice';
  if (!['manual', 'invoice', 'voice', 'n8n'].includes(resolvedSourceType)) {
    resolvedSourceType = 'invoice';
  }

  const source_id = itemData.source_id || null;

  // 1. Validasyon
  if (!productId && !searchedName) {
    throw new Error('Ürün adı (ad / urun_adi / product_name) veya product_id zorunludur.');
  }

  const qty = parseNumericPrice(rawQty);
  if (qty === null || qty <= 0) {
    throw new Error(`Geçersiz miktar: "${rawQty}". Miktar sıfırdan büyük bir sayı olmalıdır.`);
  }

  // 2. Fiyat Tespiti ve Gerekirse Toplam Tutardan Hesaplama
  const rawUnitPrice = (
    itemData.birim_fiyat ??
    itemData.birim_fiyati ??
    itemData.birimFiyat ??
    itemData.birimFiyati ??
    itemData.unit_price ??
    itemData.unitPrice ??
    itemData.fiyat ??
    itemData.alis_fiyati ??
    itemData.alisFiyati ??
    itemData.price
  );
  const rawTotalAmount = (
    itemData.toplam_tutar ??
    itemData.toplamTutar ??
    itemData.toplam_fiyat ??
    itemData.toplamFiyat ??
    itemData.tutar ??
    itemData.total_amount ??
    itemData.totalAmount ??
    itemData.total ??
    itemData.tutar_tl
  );

  let parsedIncomingPrice = parseNumericPrice(rawUnitPrice);
  let priceCalcNote = '';

  // Eğer doğrudan birim fiyat verilmemişse ancak toplam tutar verilmişse: birim_fiyat = toplam_tutar / miktar
  if (parsedIncomingPrice === null && rawTotalAmount != null && rawTotalAmount !== '') {
    const parsedTotal = parseNumericPrice(rawTotalAmount);
    if (parsedTotal !== null && parsedTotal >= 0 && qty > 0) {
      parsedIncomingPrice = Math.round((parsedTotal / qty) * 100) / 100;
      priceCalcNote = `Toplam tutar (${parsedTotal} TL) / miktar (${qty}) = ${parsedIncomingPrice} TL/birim`;
    }
  }

  const hasIncomingPrice = (parsedIncomingPrice !== null && parsedIncomingPrice >= 0);

  // 3. Ürün Belirleme (ID ile veya Akıllı Eşleştirme / Yeni Ekleme)
  let product = null;
  let matchStatus = 'direct_id';
  let isNewProduct = false;

  if (productId) {
    const { data: existingProd } = await supabase
      .from('products')
      .select('*')
      .eq('id', productId)
      .single();

    if (existingProd) {
      product = existingProd;
      matchStatus = 'direct_id';
      isNewProduct = false;
    }
  }

  if (!product && searchedName) {
    const { data: allProducts, error: listErr } = await supabase
      .from('products')
      .select('*');

    if (listErr) throw listErr;

    const match = findMatchingProduct(searchedName, allProducts || []);

    if (match && match.product) {
      product = match.product;
      matchStatus = 'matched';
      isNewProduct = false;
    } else {
      // Eşleşme yok: Yeni ürün olarak ekle
      const { data: maxRows } = await supabase
        .from('products')
        .select('id')
        .order('id', { ascending: false })
        .limit(1);

      const nextId = (maxRows && maxRows.length > 0 && maxRows[0].id) ? maxRows[0].id + 1 : 1;
      const newCritical = critical_threshold != null && !isNaN(parseFloat(critical_threshold))
        ? parseFloat(critical_threshold)
        : 0;
      const newProtein = protein_per_unit != null && !isNaN(parseFloat(protein_per_unit))
        ? parseFloat(protein_per_unit)
        : 0;

      const insertPayload = {
        id: nextId,
        name: searchedName.slice(0, 150),
        unit: unit || 'kg',
        category: category || 'genel',
        critical_threshold: newCritical,
        protein_per_unit: newProtein
      };

      if (hasIncomingPrice) {
        insertPayload.unit_price = parsedIncomingPrice;
      }

      let { data: createdProd, error: createErr } = await supabase
        .from('products')
        .insert([insertPayload])
        .select('*')
        .single();

      if (createErr && (createErr.code === '42703' || createErr.message?.includes('unit_price'))) {
        delete insertPayload.unit_price;
        const retry = await supabase
          .from('products')
          .insert([insertPayload])
          .select('*')
          .single();
        createdProd = retry.data;
        createErr = retry.error;
      }

      if (createErr) throw createErr;

      product = createdProd;
      matchStatus = 'created';
      isNewProduct = true;
    }
  }

  if (!product) {
    throw new Error(`Belirtilen ürün (${productId || searchedName}) sistemde bulunamadı ve oluşturulamadı.`);
  }

  // 4. Stok Hareketi Ekle (trigger otomatik current_stock günceller)
  const { data: transaction, error: txErr } = await supabase
    .from('stock_transactions')
    .insert([{
      product_id: product.id,
      transaction_type: 'in',
      quantity:          qty,
      source_type:       resolvedSourceType,
      source_id,
      transaction_date
    }])
    .select()
    .single();

  if (txErr) throw txErr;

  // 5. Güncel Stoku Getir
  const { data: stock } = await supabase
    .from('current_stock')
    .select('quantity')
    .eq('product_id', product.id)
    .single();

  // 6. Kritik Stok Uyarısı Kontrolü
  checkStockAlerts([product.id]).catch(err => {
    console.error('[Stok Uyarı Hatası - stock/in]', err.message);
  });

  // 7. Fiyat Güncellemesi
  // Kural: Fatura/girişte geçerli fiyat varsa hem yerel servise hem Supabase'e kaydet. Fiyat yoksa mevcut fiyata DOKUNMA!
  let priceUpdated = false;
  const previousPrice = product.unit_price ?? getPrice(product.id, product.name);

  if (hasIncomingPrice) {
    // A. Yerel fiyat servisine hemen kaydet (Supabase kolonu olmasa dahi veri asla kaybolmaz)
    setPrice(product.id, product.name, parsedIncomingPrice);
    product.unit_price = parsedIncomingPrice;
    priceUpdated = true;

    // B. Supabase tablosuna da kaydetmeyi dene
    try {
      const { error: priceErr } = await supabase
        .from('products')
        .update({ unit_price: parsedIncomingPrice })
        .eq('id', product.id);

      if (priceErr && priceErr.code !== '42703' && !priceErr.message?.includes('unit_price')) {
        console.warn(`[stock/in] Supabase unit_price güncelleme uyarısı (${product.name}):`, priceErr.message);
      }
    } catch (pErr) {
      console.warn(`[stock/in] Supabase fiyat hatası (${product.name}):`, pErr.message);
    }
  } else {
    product.unit_price = previousPrice;
  }

  // 8. Railway Canlı Log Yazımı (Kullanıcının Railway panelinden anında görebilmesi için)
  if (priceUpdated) {
    console.log('======================================================================');
    console.log(`💰 [RAILWAY LOG - FİYAT GÜNCELLENDİ]`);
    console.log(`   Ürün: "${product.name}" (ID: ${product.id})`);
    console.log(`   Önceki Fiyat: ${previousPrice != null ? previousPrice + ' TL' : 'Kayıtlı fiyat yok'}`);
    console.log(`   Yeni Birim Fiyat: ${parsedIncomingPrice.toFixed(2)} TL`);
    console.log(`   Eklenen Miktar: +${qty} ${product.unit}`);
    if (priceCalcNote) {
      console.log(`   Hesaplama: ${priceCalcNote}`);
    }
    console.log(`   AI'dan Gelen Ham Kayıt: ${JSON.stringify(itemData)}`);
    console.log('======================================================================');
  } else {
    console.log(`ℹ️ [RAILWAY LOG - FİYAT DEĞİŞMEDİ] Ürün: "${product.name}" (ID: ${product.id}) | Faturada fiyat yer almadı. Mevcut Fiyat: ${previousPrice != null ? previousPrice + ' TL' : 'Kayıtlı fiyat yok'} | AI'dan gelen: ${JSON.stringify(itemData)}`);
  }

  let message = '';
  if (matchStatus === 'created') {
    message = `'${searchedName}' ürünü sistemde bulunamadığı için yeni ürün olarak oluşturuldu (${product.name}, ${product.unit}). ${qty} ${product.unit} stok girişi yapıldı.`;
  } else if (matchStatus === 'matched') {
    message = `'${searchedName}' faturadaki ürün, mevcut '${product.name}' (${product.unit}) ile eşleşti. ${qty} ${product.unit} stok girişi yapıldı.`;
  } else {
    message = `${product.name} için ${qty} ${product.unit} stok girişi yapıldı.`;
  }

  if (priceUpdated) {
    message += ` (Birim fiyat: ${parsedIncomingPrice} TL güncellendi)`;
  }

  return {
    success: true,
    message,
    match_status: matchStatus,
    is_new_product: isNewProduct,
    price_updated: priceUpdated,
    price_calc_note: priceCalcNote || null,
    product: {
      id: product.id,
      name: product.name,
      unit: product.unit,
      category: product.category,
      unit_price: product.unit_price ?? null
    },
    searched_name: searchedName || null,
    transaction,
    current_stock: stock?.quantity ?? null
  };
}

router.post('/in', async (req, res) => {
  try {
    console.log('📥 [POST /api/stock/in] İstek alındı. Gövde:', JSON.stringify(req.body));

    const rawItems = Array.isArray(req.body)
      ? req.body
      : (Array.isArray(req.body?.items) ? req.body.items : (Array.isArray(req.body?.products) ? req.body.products : [req.body]));

    if (!rawItems || rawItems.length === 0) {
      return res.status(400).json({ success: false, error: 'İşlenecek stok verisi bulunamadı.' });
    }

    const results = [];
    const updatedPrices = [];
    const unchangedPrices = [];

    for (const item of rawItems) {
      try {
        const itemResult = await processStockInItem(item);
        results.push(itemResult);
        if (itemResult.price_updated) {
          updatedPrices.push(`${itemResult.product.name} (${itemResult.product.unit_price} TL)`);
        } else {
          unchangedPrices.push(itemResult.product?.name || item.product_name || item.name || item.urun_adi);
        }
      } catch (err) {
        console.error('[stock/in] Satır işleme hatası:', err.message, item);
        results.push({
          success: false,
          error: err.message,
          raw_item: item
        });
      }
    }

    if (rawItems.length > 1) {
      console.log(`📦 [FATURA BATCH TAMAMLANDI] Toplam ${rawItems.length} kalem işlendi.`);
      console.log(`   - Fiyatı Güncellenenler (${updatedPrices.length}): ${updatedPrices.join(', ') || 'Yok'}`);
      console.log(`   - Fiyatı Değişmeyenler (${unchangedPrices.length}): ${unchangedPrices.join(', ') || 'Yok'}`);
    }

    // Tekli çağrı yapılmışsa ve gelen gövde dizi değilse geriye tek nesne dön
    if (rawItems.length === 1 && !Array.isArray(req.body) && !req.body.items && !req.body.products) {
      const single = results[0];
      if (!single.success) {
        return res.status(400).json(single);
      }
      return res.status(201).json(single);
    }

    res.status(201).json({
      success: true,
      processed_count: results.length,
      updated_prices_count: updatedPrices.length,
      results
    });
  } catch (err) {
    console.error('[stock/in] Genel hata:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /api/stock/out ─────────────────────────────────────────────────────
// Manuel stok çıkışı (tüketim, fire, zayi) kaydeder ve gerekirse Telegram uyarısı gönderir.
router.post('/out', async (req, res) => {
  try {
    const {
      product_id,
      quantity,
      transaction_date,
      source_type = 'manual',
      source_id = null
    } = req.body;

    if (!product_id || quantity == null) {
      return res.status(400).json({
        success: false,
        error: 'product_id ve quantity alanları zorunludur.'
      });
    }

    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) {
      return res.status(400).json({
        success: false,
        error: 'quantity 0\'dan büyük bir sayı olmalıdır.'
      });
    }

    const { data: product, error: prodErr } = await supabase
      .from('products')
      .select('id, name, unit, critical_threshold')
      .eq('id', product_id)
      .single();

    if (prodErr || !product) {
      return res.status(404).json({
        success: false,
        error: 'Ürün bulunamadı.'
      });
    }

    // Stok çıkış hareketi ekle (Trigger otomatik olarak current_stock'u azaltır)
    const { data: transaction, error: txErr } = await supabase
      .from('stock_transactions')
      .insert([{
        product_id: product.id,
        transaction_type: 'out',
        quantity:          qty,
        source_type:       source_type || 'manual',
        source_id,
        transaction_date:  transaction_date || new Date().toISOString().split('T')[0]
      }])
      .select()
      .single();

    if (txErr) throw txErr;

    // Güncel stoku çek
    const { data: stock } = await supabase
      .from('current_stock')
      .select('quantity')
      .eq('product_id', product.id)
      .single();

    // Kritik stok kontrolü ve Telegram uyarısı
    checkStockAlerts([product.id]).catch(err => {
      console.error('[Stok Uyarı Hatası - stock/out]', err.message);
    });

    res.status(201).json({
      success: true,
      message: `${product.name} için ${qty} ${product.unit} stok çıkışı yapıldı.`,
      product: {
        id: product.id,
        name: product.name,
        unit: product.unit
      },
      transaction,
      current_stock: stock?.quantity ?? null
    });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /api/stock/transaction ─────────────────────────────────────────────
// Genel manuel işlem (in, out, waste)
router.post('/transaction', async (req, res) => {
  try {
    const {
      product_id,
      transaction_type = 'out',
      quantity,
      transaction_date,
      source_type = 'manual',
      source_id = null
    } = req.body;

    const validTypes = ['in', 'out', 'waste'];
    if (!validTypes.includes(transaction_type)) {
      return res.status(400).json({
        success: false,
        error: `Geçersiz transaction_type. İzin verilenler: ${validTypes.join(', ')}`
      });
    }

    if (!product_id || quantity == null) {
      return res.status(400).json({
        success: false,
        error: 'product_id ve quantity alanları zorunludur.'
      });
    }

    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) {
      return res.status(400).json({
        success: false,
        error: 'quantity 0\'dan büyük bir sayı olmalıdır.'
      });
    }

    const { data: product, error: prodErr } = await supabase
      .from('products')
      .select('id, name, unit, critical_threshold')
      .eq('id', product_id)
      .single();

    if (prodErr || !product) {
      return res.status(404).json({ success: false, error: 'Ürün bulunamadı.' });
    }

    const { data: transaction, error: txErr } = await supabase
      .from('stock_transactions')
      .insert([{
        product_id: product.id,
        transaction_type,
        quantity: qty,
        source_type: source_type || 'manual',
        source_id,
        transaction_date: transaction_date || new Date().toISOString().split('T')[0]
      }])
      .select()
      .single();

    if (txErr) throw txErr;

    const { data: stock } = await supabase
      .from('current_stock')
      .select('quantity')
      .eq('product_id', product.id)
      .single();

    // Kritik seviye kontrolü (in durumunda eşik üstü sıfırlama, out/waste durumunda uyarı)
    checkStockAlerts([product.id]).catch(err => {
      console.error('[Stok Uyarı Hatası - stock/transaction]', err.message);
    });

    res.status(201).json({
      success: true,
      message: `${product.name} için ${qty} ${product.unit} (${transaction_type}) işlemi kaydedildi.`,
      product: {
        id: product.id,
        name: product.name,
        unit: product.unit
      },
      transaction,
      current_stock: stock?.quantity ?? null
    });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /api/stock/test-telegram ───────────────────────────────────────────
// Telegram bot bağlantısını test eder
router.post('/test-telegram', async (req, res) => {
  try {
    const { sendTelegramMessage, getTelegramConfig } = require('../services/telegramService');
    const { token, chatId } = getTelegramConfig();

    if (!token || !chatId) {
      return res.status(400).json({
        success: false,
        error: 'TELEGRAM_BOT_TOKEN veya TELEGRAM_CHAT_ID ortam değişkeni eksik. Lütfen Railway ayarlarından ekleyin.'
      });
    }

    const testText = req.body.message || '⚠️ [Test] Anaokulu Yemekhane Stok Takip Sistemi — Telegram bildirim bağlantısı başarılı!';
    const result = await sendTelegramMessage(testText);

    if (result.success) {
      res.json({ success: true, message: 'Test bildirimi Telegram\'a başarıyla gönderildi.' });
    } else {
      res.status(502).json({ success: false, error: result.error || 'Telegram mesajı iletilemedi.' });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /api/stock/alert-state ──────────────────────────────────────────────
// Mevcut uyarı durumu (hangi ürünler için uyarı açık)
router.get('/alert-state', (req, res) => {
  try {
    const { getAlertState } = require('../services/stockAlertService');
    res.json({ success: true, ...getAlertState() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /api/stock/check-alerts ────────────────────────────────────────────
// Tüm ürünleri kontrol edip gerekiyorsa uyarıları tetikler
router.post('/check-alerts', async (req, res) => {
  try {
    const result = await checkStockAlerts();
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /api/stock/current ──────────────────────────────────────────────────
// Tüm ürünlerin güncel stoğunu getirir.
// is_critical=true  → critical_threshold'un altındaki ürünler
// ?critical=true    → sadece kritik ürünleri listele
router.get('/current', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('current_stock')
      .select(`
        quantity,
        last_updated,
        products (
          id,
          name,
          unit,
          category,
          critical_threshold,
          protein_per_unit
        )
      `)
      .order('products(category)')
      .order('products(name)');

    if (error) throw error;

    // Kritik stok hesapla ve düzleştir
    let result = data.map(row => ({
      product_id:         row.products.id,
      name:               row.products.name,
      unit:               row.products.unit,
      category:           row.products.category,
      quantity:           parseFloat(row.quantity),
      critical_threshold: parseFloat(row.products.critical_threshold),
      protein_per_unit:   row.products.protein_per_unit,
      is_critical:        parseFloat(row.quantity) <= parseFloat(row.products.critical_threshold),
      last_updated:       row.last_updated
    }));

    // ?critical=true filtresi
    if (req.query.critical === 'true') {
      result = result.filter(r => r.is_critical);
    }

    const criticalCount = result.filter(r => r.is_critical).length;

    res.json({
      success: true,
      count:          result.length,
      critical_count: criticalCount,
      data:           result
    });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
