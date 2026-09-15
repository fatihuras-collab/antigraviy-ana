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

    let transactions = [];
    let { data: txData, error: txErr } = await supabase
      .from('stock_transactions')
      .select(`
        *,
        products (
          id,
          name,
          unit,
          category,
          unit_price
        )
      `)
      .eq('transaction_type', 'out')
      .gte('transaction_date', startDateStr)
      .order('transaction_date', { ascending: true });

    if (txErr && (txErr.code === '42703' || txErr.message?.includes('unit_price'))) {
      const retry = await supabase
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
      txData = retry.data;
      txErr = retry.error;
    }
    if (txErr) throw txErr;
    transactions = txData || [];

    // 2. Tüm ürün listesini getir (ürün trend grafiği dropdown'ı için)
    let allProducts = [];
    let { data: prodData, error: prodErr } = await supabase
      .from('products')
      .select('id, name, unit, category, unit_price')
      .order('name');

    if (prodErr && (prodErr.code === '42703' || prodErr.message?.includes('unit_price'))) {
      const retryProd = await supabase
        .from('products')
        .select('id, name, unit, category')
        .order('name');
      prodData = retryProd.data;
      prodErr = retryProd.error;
    }
    if (prodErr) throw prodErr;
    allProducts = prodData || [];

    // Birim fiyat verisi var mı kontrol et (ürün unit_price veya işlem unit_price)
    const hasPriceData = (transactions || []).some(
      t => (t.products?.unit_price != null && !isNaN(parseFloat(t.products.unit_price)) && parseFloat(t.products.unit_price) > 0) ||
           (t.unit_price != null && !isNaN(parseFloat(t.unit_price)) && parseFloat(t.unit_price) > 0)
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
