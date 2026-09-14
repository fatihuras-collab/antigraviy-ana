/**
 * ÜRÜN ROUTE'LARI
 * GET    /api/products          — Tüm ürünleri listele
 * GET    /api/products/:id      — Tek ürün getir
 * POST   /api/products          — Yeni ürün ekle
 * DELETE /api/products/:id      — Ürün sil (stok hareketi yoksa)
 */

const express = require('express');
const router  = express.Router();
const supabase = require('../supabase');

// Ürün nesnesine güncel stok bilgisini ekleyen yardımcı fonksiyon
function formatProductWithStock(p) {
  let qty = 0;
  if (p.current_stock) {
    if (typeof p.current_stock === 'object' && !Array.isArray(p.current_stock)) {
      qty = p.current_stock.quantity != null ? parseFloat(p.current_stock.quantity) : 0;
    } else if (Array.isArray(p.current_stock) && p.current_stock.length > 0) {
      qty = p.current_stock[0]?.quantity != null ? parseFloat(p.current_stock[0].quantity) : 0;
    }
  }
  return {
    ...p,
    stock_quantity: qty,
    current_stock: { quantity: qty }
  };
}

// ─── GET /api/products ───────────────────────────────────────────────────────
// Tüm ürünleri, isteğe bağlı category filtresiyle listele
// ?category=et  →  sadece et kategorisindeki ürünler
router.get('/', async (req, res) => {
  try {
    let query = supabase
      .from('products')
      .select('*, current_stock(quantity)')
      .order('category')
      .order('name');

    if (req.query.category) {
      query = query.eq('category', req.query.category);
    }

    const { data, error } = await query;
    if (error) throw error;

    const formatted = (data || []).map(formatProductWithStock);

    res.json({ success: true, count: formatted.length, data: formatted });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /api/products/:id ───────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*, current_stock(quantity)')
      .eq('id', req.params.id)
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ success: false, error: 'Ürün bulunamadı.' });

    res.json({ success: true, data: formatProductWithStock(data) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /api/products ──────────────────────────────────────────────────────
// Zorunlu: name, unit
// Opsiyonel: category, critical_threshold, protein_per_unit
router.post('/', async (req, res) => {
  try {
    const { name, unit, category, critical_threshold, protein_per_unit } = req.body;

    if (!name || !unit) {
      return res.status(400).json({
        success: false,
        error: 'name ve unit alanları zorunludur.'
      });
    }

    const { data, error } = await supabase
      .from('products')
      .insert([{ name, unit, category, critical_threshold, protein_per_unit }])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── PUT /api/products/:id ───────────────────────────────────────────────────
// Ürünü güncelle (ID korunur, stok geçmişi ve reçete bağlantıları bozulmaz)
// Zorunlu: name, unit
// Opsiyonel: category, critical_threshold, protein_per_unit
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, unit, category, critical_threshold, protein_per_unit } = req.body;

    if (!name || !unit) {
      return res.status(400).json({
        success: false,
        error: 'name ve unit alanları zorunludur.'
      });
    }

    const updateData = {
      name: name.trim(),
      unit: unit.trim(),
      category: category || null,
      critical_threshold: (critical_threshold !== undefined && critical_threshold !== '' && critical_threshold !== null)
        ? parseFloat(critical_threshold)
        : null,
      protein_per_unit: (protein_per_unit !== undefined && protein_per_unit !== '' && protein_per_unit !== null)
        ? parseFloat(protein_per_unit)
        : null
    };

    const { data, error } = await supabase
      .from('products')
      .update(updateData)
      .eq('id', id)
      .select('*, current_stock(quantity)')
      .single();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ success: false, error: 'Güncellenecek ürün bulunamadı.' });
    }

    res.json({ success: true, message: 'Ürün başarıyla güncellendi.', data: formatProductWithStock(data) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── DELETE /api/products/:id ────────────────────────────────────────────────
// Ürünü sil. Stok hareketi kayıtları varsa Supabase FK kısıtı hata verir.
router.delete('/:id', async (req, res) => {
  try {
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', req.params.id);

    if (error) {
      // FK ihlali: bu ürüne bağlı stok/reçete kaydı var
      if (error.code === '23503') {
        return res.status(409).json({
          success: false,
          error: 'Bu ürüne ait stok hareketi veya reçete kaydı mevcut, silinemez.'
        });
      }
      throw error;
    }

    res.json({ success: true, message: 'Ürün silindi.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
