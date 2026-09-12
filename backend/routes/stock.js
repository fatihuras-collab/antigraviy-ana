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
// Örnek body (n8n / Fatura - İsim ile):
// {
//   "product_name": "Elma (Starking)",
//   "quantity": 10,
//   "unit": "kg",
//   "source_type": "invoice"
// }
router.post('/in', async (req, res) => {
  try {
    const {
      product_id,
      product_name,
      name,
      quantity,
      unit,
      category,
      critical_threshold,
      protein_per_unit,
      transaction_date,
      source_type = 'manual',
      source_id   = null
    } = req.body;

    const searchedName = (product_name || name || '').toString().trim();

    // ── Validasyon ────────────────────────────────────────────────────────────
    if ((!product_id && !searchedName) || quantity == null) {
      return res.status(400).json({
        success: false,
        error: 'product_id veya product_name (ürün adı) ile quantity alanları zorunludur.'
      });
    }

    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) {
      return res.status(400).json({
        success: false,
        error: 'quantity sıfırdan büyük bir sayı olmalıdır.'
      });
    }

    let resolvedSourceType = (source_type || 'manual').toString().toLowerCase().trim();
    if (resolvedSourceType === 'fatura') resolvedSourceType = 'invoice';
    if (resolvedSourceType === 'ses' || resolvedSourceType === 'sesli') resolvedSourceType = 'voice';

    const validSources = ['manual', 'invoice', 'voice', 'n8n'];
    if (!validSources.includes(resolvedSourceType)) {
      resolvedSourceType = 'invoice';
    }

    // ── Ürün Belirleme (ID ile veya İsim ile Eşleştirme / Yeni Ekleme) ──────────
    let product = null;
    let matchStatus = 'direct_id'; // 'direct_id' | 'matched' | 'created'
    let isNewProduct = false;

    if (product_id) {
      const { data: existingProd, error: productErr } = await supabase
        .from('products')
        .select('id, name, unit, category')
        .eq('id', product_id)
        .single();

      if (existingProd) {
        product = existingProd;
        matchStatus = 'direct_id';
        isNewProduct = false;
      }
    }

    // Eğer product_id verilmediyse veya bulunamadıysa isim ile eşleştir
    if (!product && searchedName) {
      const { data: allProducts, error: listErr } = await supabase
        .from('products')
        .select('id, name, unit, category');

      if (listErr) throw listErr;

      const match = findMatchingProduct(searchedName, allProducts || []);

      if (match && match.product) {
        product = match.product;
        matchStatus = 'matched';
        isNewProduct = false;
      } else {
        // Eşleşme bulunamadı: Yeni ürün olarak ekle
        // PostgreSQL sequence kayması durumunda pkey hatasını önlemek için son id'yi bulup ilerlet
        const { data: maxRows } = await supabase
          .from('products')
          .select('id')
          .order('id', { ascending: false })
          .limit(1);

        const nextId = (maxRows && maxRows.length > 0 && maxRows[0].id) ? maxRows[0].id + 1 : 1;

        const newUnit = (unit || 'kg').toString().trim().slice(0, 20);
        const newCategory = (category || 'genel').toString().trim().slice(0, 80);
        const newCritical = critical_threshold != null && !isNaN(parseFloat(critical_threshold))
          ? parseFloat(critical_threshold)
          : 0;
        const newProtein = protein_per_unit != null && !isNaN(parseFloat(protein_per_unit))
          ? parseFloat(protein_per_unit)
          : 0;

        const { data: createdProd, error: createErr } = await supabase
          .from('products')
          .insert([{
            id: nextId,
            name: searchedName.slice(0, 150),
            unit: newUnit,
            category: newCategory,
            critical_threshold: newCritical,
            protein_per_unit: newProtein
          }])
          .select('id, name, unit, category')
          .single();

        if (createErr) throw createErr;

        product = createdProd;
        matchStatus = 'created';
        isNewProduct = true;
      }
    }

    if (!product) {
      return res.status(404).json({
        success: false,
        error: `Belirtilen ürün (${product_id || searchedName}) bulunamadı ve oluşturulamadı.`
      });
    }

    // ── Stok hareketi ekle ───────────────────────────────────────────────────
    // Trigger (trg_update_stock) otomatik olarak current_stock'u günceller
    const { data: transaction, error: txErr } = await supabase
      .from('stock_transactions')
      .insert([{
        product_id: product.id,
        transaction_type: 'in',
        quantity:          qty,
        source_type:       resolvedSourceType,
        source_id,
        transaction_date:  transaction_date || new Date().toISOString().split('T')[0]
      }])
      .select()
      .single();

    if (txErr) throw txErr;

    // ── Güncel stoku getir (trigger sonrası) ─────────────────────────────────
    const { data: stock } = await supabase
      .from('current_stock')
      .select('quantity')
      .eq('product_id', product.id)
      .single();

    // ── Yanıt mesajı ─────────────────────────────────────────────────────────
    let message = '';
    if (matchStatus === 'created') {
      message = `'${searchedName}' ürünü sistemde bulunamadığı için yeni ürün olarak oluşturuldu (${product.name}, ${product.unit}). ${qty} ${product.unit} stok girişi yapıldı.`;
    } else if (matchStatus === 'matched') {
      message = `'${searchedName}' faturadaki ürün, mevcut '${product.name}' (${product.unit}) ile eşleşti. ${qty} ${product.unit} stok girişi yapıldı.`;
    } else {
      message = `${product.name} için ${qty} ${product.unit} stok girişi yapıldı.`;
    }

    res.status(201).json({
      success: true,
      message,
      match_status: matchStatus,
      is_new_product: isNewProduct,
      product: {
        id: product.id,
        name: product.name,
        unit: product.unit,
        category: product.category
      },
      searched_name: searchedName || null,
      transaction,
      current_stock: stock?.quantity ?? null
    });

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
