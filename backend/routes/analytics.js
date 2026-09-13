/**
 * ANALİTİK & TÜKETİM GÖSTERGE PANELİ ROUTE'LARI
 * ============================================
 * GET /api/analytics/summary — Son 6-12 ayın 'out' hareketleri ve ürün listesi
 */

const express = require('express');
const router  = express.Router();
const supabase = require('../supabase');

// ── GET /api/analytics/summary ────────────────────────────────────────────────
// stock_transactions geçmişindeki 'out' (tüketim) kayıtlarını çeker.
// current_stock yerine doğrudan 'out' geçmişini baz alır.
router.get('/summary', async (req, res) => {
  try {
    const rangeMonths = Math.min(Math.max(parseInt(req.query.months, 10) || 12, 1), 24);

    // Başlangıç tarihi (örn. N ay önceki ayın 1. günü)
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - rangeMonths);
    startDate.setDate(1);
    const startDateStr = startDate.toISOString().split('T')[0];

    // 1. Sadece 'out' hareketlerini getir
    const { data: transactions, error: txErr } = await supabase
      .from('stock_transactions')
      .select(`
        *,
        products (
          id,
          name,
          unit,
          category
        )
      `)
      .eq('transaction_type', 'out')
      .gte('transaction_date', startDateStr)
      .order('transaction_date', { ascending: true });

    if (txErr) throw txErr;

    // 2. Tüm ürün listesini getir (ürün trend grafiği dropdown'ı için)
    const { data: allProducts, error: prodErr } = await supabase
      .from('products')
      .select('id, name, unit, category')
      .order('name');

    if (prodErr) throw prodErr;

    // Birim fiyat verisi var mı kontrol et
    const hasPriceData = (transactions || []).some(
      t => t.unit_price != null && !isNaN(parseFloat(t.unit_price)) && parseFloat(t.unit_price) > 0
    );

    res.json({
      success: true,
      has_price_data: hasPriceData,
      count: transactions ? transactions.length : 0,
      data: {
        transactions: transactions || [],
        products: allProducts || []
      }
    });
  } catch (err) {
    console.error('[analytics/summary HATA]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
