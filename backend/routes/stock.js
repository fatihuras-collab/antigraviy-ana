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

// ─── POST /api/stock/in ──────────────────────────────────────────────────────
// Zorunlu: product_id, quantity
// Opsiyonel: transaction_date (varsayılan: bugün), source_type (varsayılan: 'manual')
//
// Örnek body:
// {
//   "product_id": 1,
//   "quantity": 10.5,
//   "transaction_date": "2026-09-11",   // opsiyonel
//   "source_type": "manual"             // opsiyonel: 'manual' | 'invoice' | 'voice'
// }
router.post('/in', async (req, res) => {
  try {
    const {
      product_id,
      quantity,
      transaction_date,
      source_type = 'manual',
      source_id   = null
    } = req.body;

    // ── Validasyon ────────────────────────────────────────────────────────────
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
        error: 'quantity sıfırdan büyük bir sayı olmalıdır.'
      });
    }

    const validSources = ['manual', 'invoice', 'voice'];
    if (!validSources.includes(source_type)) {
      return res.status(400).json({
        success: false,
        error: `source_type şunlardan biri olmalıdır: ${validSources.join(', ')}`
      });
    }

    // ── Ürün var mı kontrolü ─────────────────────────────────────────────────
    const { data: product, error: productErr } = await supabase
      .from('products')
      .select('id, name, unit')
      .eq('id', product_id)
      .single();

    if (productErr || !product) {
      return res.status(404).json({
        success: false,
        error: `product_id=${product_id} bulunamadı.`
      });
    }

    // ── Stok hareketi ekle ───────────────────────────────────────────────────
    // Trigger (trg_update_stock) otomatik olarak current_stock'u günceller
    const { data: transaction, error: txErr } = await supabase
      .from('stock_transactions')
      .insert([{
        product_id,
        transaction_type: 'in',
        quantity:          qty,
        source_type,
        source_id,
        transaction_date: transaction_date || new Date().toISOString().split('T')[0]
      }])
      .select()
      .single();

    if (txErr) throw txErr;

    // ── Güncel stoku getir (trigger sonrası) ─────────────────────────────────
    const { data: stock } = await supabase
      .from('current_stock')
      .select('quantity')
      .eq('product_id', product_id)
      .single();

    res.status(201).json({
      success: true,
      message: `${product.name} için ${qty} ${product.unit} stok girişi yapıldı.`,
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
