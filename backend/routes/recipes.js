/**
 * REÇETE YÖNETİM ROUTE'LARI
 *
 * GET    /api/recipes               — Tüm reçeteleri (içeriklerle birlikte) listele
 * POST   /api/recipes               — Yeni reçete + içerik listesi ekle
 * DELETE /api/recipes/:id           — Reçete sil (meal_plans kaydı yoksa)
 *
 * GET    /api/recipes/:id/ingredients   — Tek reçetenin içeriklerini getir
 */

const express  = require('express');
const router   = express.Router();
const supabase = require('../supabase');

const VALID_MEAL_TYPES = ['kahvalti', 'ogle', 'ikindi'];

// ─── GET /api/recipes ─────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    let recipes;
    const { data: rData, error: rErr } = await supabase
      .from('recipes')
      .select(`
        id,
        meal_name,
        meal_type,
        is_draft,
        created_at,
        recipe_ingredients (
          id,
          quantity_per_portion,
          products (
            id,
            name,
            unit
          )
        )
      `)
      .order('meal_type')
      .order('meal_name');

    if (rErr) {
      // is_draft kolonu yoksa is_draft'sız çek
      const { data: fallbackData, error: fbErr } = await supabase
        .from('recipes')
        .select(`
          id,
          meal_name,
          meal_type,
          created_at,
          recipe_ingredients (
            id,
            quantity_per_portion,
            products (
              id,
              name,
              unit
            )
          )
        `)
        .order('meal_type')
        .order('meal_name');

      if (fbErr) throw fbErr;
      recipes = fallbackData;
    } else {
      recipes = rData;
    }

    const formatted = (recipes || []).map(r => ({
      id:         r.id,
      meal_name:  r.meal_name,
      meal_type:  r.meal_type,
      // is_draft: alan henüz tabloda yoksa null gelir, ?? false ile güvenli varsayılan
      is_draft:   r.is_draft ?? false,
      created_at: r.created_at,
      ingredients: (r.recipe_ingredients || []).map(ing => ({
        id:                   ing.id,
        product_id:           ing.products?.id,
        product_name:         ing.products?.name,
        unit:                 ing.products?.unit,
        quantity_per_portion: ing.quantity_per_portion
      }))
    }));

    res.json({ success: true, count: formatted.length, data: formatted });
  } catch (err) {
    console.error('[GET recipes HATA]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /api/recipes/:id/ingredients ─────────────────────────────────────────
router.get('/:id/ingredients', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('recipe_ingredients')
      .select(`
        id,
        quantity_per_portion,
        products (id, name, unit)
      `)
      .eq('recipe_id', req.params.id);

    if (error) throw error;

    res.json({
      success: true,
      data: (data || []).map(ing => ({
        id:                   ing.id,
        product_id:           ing.products?.id,
        product_name:         ing.products?.name,
        unit:                 ing.products?.unit,
        quantity_per_portion: ing.quantity_per_portion
      }))
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /api/recipes ────────────────────────────────────────────────────────
// Body: { meal_name, meal_type, is_draft?, ingredients: [{product_id, quantity_per_portion}] }
router.post('/', async (req, res) => {
  const { meal_name, meal_type, is_draft, ingredients } = req.body;

  if (!meal_name || !meal_name.trim()) {
    return res.status(400).json({ success: false, error: 'meal_name zorunludur.' });
  }

  const mType = (meal_type || 'ogle').toLowerCase();
  if (!VALID_MEAL_TYPES.includes(mType)) {
    return res.status(400).json({
      success: false,
      error: `meal_type geçersiz. Şunlardan biri olmalı: ${VALID_MEAL_TYPES.join(', ')}`
    });
  }

  if (!ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
    return res.status(400).json({ success: false, error: 'En az 1 malzeme (ingredients) girilmelidir.' });
  }

  for (const ing of ingredients) {
    if (!ing.product_id || !ing.quantity_per_portion) {
      return res.status(400).json({
        success: false,
        error: 'Her malzemede product_id ve quantity_per_portion zorunludur.'
      });
    }
    if (parseFloat(ing.quantity_per_portion) <= 0) {
      return res.status(400).json({ success: false, error: 'quantity_per_portion sıfırdan büyük olmalıdır.' });
    }
  }

  try {
    const insertPayload = { meal_name: meal_name.trim(), meal_type: mType };
    // is_draft: sadece alan tabloda mevcutsa anlamlı (migrasyon sonrası)
    if (typeof is_draft === 'boolean') insertPayload.is_draft = is_draft;

    let recipe;
    const { data: rData, error: rErr } = await supabase
      .from('recipes')
      .insert([insertPayload])
      .select()
      .single();

    if (rErr && rErr.code === '23505') {
      // Sequence senkronize değilse max ID + 1 ile ekle
      const { data: maxRows } = await supabase
        .from('recipes')
        .select('id')
        .order('id', { ascending: false })
        .limit(1);
      const nextId = (maxRows?.[0]?.id || 0) + 1;
      const { data: retryData, error: retryErr } = await supabase
        .from('recipes')
        .insert([{ ...insertPayload, id: nextId }])
        .select()
        .single();
      if (retryErr) throw retryErr;
      recipe = retryData;
    } else if (rErr) {
      throw rErr;
    } else {
      recipe = rData;
    }

    // 2. İçerikleri toplu ekle
    const ingRows = ingredients.map(ing => ({
      recipe_id:            recipe.id,
      product_id:           parseInt(ing.product_id, 10),
      quantity_per_portion: parseFloat(ing.quantity_per_portion)
    }));

    const { error: ingErr } = await supabase
      .from('recipe_ingredients')
      .insert(ingRows);

    if (ingErr) {
      // Reçeteyi geri al
      await supabase.from('recipes').delete().eq('id', recipe.id);
      throw ingErr;
    }

    res.status(201).json({
      success: true,
      message: `"${recipe.meal_name}" reçetesi ${ingRows.length} malzemeyle eklendi.`,
      data: { recipe_id: recipe.id, meal_name: recipe.meal_name, meal_type: recipe.meal_type }
    });

  } catch (err) {
    console.error('[POST recipes HATA]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── PUT /api/recipes/:id ───────────────────────────────────────────────────
// Body: { meal_name, meal_type, is_draft?, ingredients: [{product_id, quantity_per_portion}] }
router.put('/:id', async (req, res) => {
  const rid = parseInt(req.params.id, 10);
  const { meal_name, meal_type, is_draft, ingredients } = req.body;

  if (!rid) {
    return res.status(400).json({ success: false, error: 'Geçersiz reçete ID.' });
  }

  if (!meal_name || !meal_name.trim()) {
    return res.status(400).json({ success: false, error: 'meal_name zorunludur.' });
  }

  const mType = (meal_type || 'ogle').toLowerCase();
  if (!VALID_MEAL_TYPES.includes(mType)) {
    return res.status(400).json({
      success: false,
      error: `meal_type geçersiz. Şunlardan biri olmalı: ${VALID_MEAL_TYPES.join(', ')}`
    });
  }

  try {
    const updatePayload = { meal_name: meal_name.trim(), meal_type: mType };
    if (typeof is_draft === 'boolean') {
      updatePayload.is_draft = is_draft;
    }

    let recipe;
    const { data: rData, error: rErr } = await supabase
      .from('recipes')
      .update(updatePayload)
      .eq('id', rid)
      .select()
      .single();

    if (rErr && rErr.message && rErr.message.includes('is_draft')) {
      delete updatePayload.is_draft;
      const { data: retryData, error: retryErr } = await supabase
        .from('recipes')
        .update(updatePayload)
        .eq('id', rid)
        .select()
        .single();
      if (retryErr) throw retryErr;
      recipe = retryData;
    } else if (rErr) {
      throw rErr;
    } else {
      recipe = rData;
    }

    // Malzemeleri güncelle (mevcutları silip yenilerini ekle)
    if (Array.isArray(ingredients)) {
      await supabase.from('recipe_ingredients').delete().eq('recipe_id', rid);

      if (ingredients.length > 0) {
        const ingRows = ingredients.map(ing => ({
          recipe_id:            rid,
          product_id:           parseInt(ing.product_id, 10),
          quantity_per_portion: parseFloat(ing.quantity_per_portion)
        }));

        const { error: ingErr } = await supabase
          .from('recipe_ingredients')
          .insert(ingRows);

        if (ingErr) throw ingErr;
      }
    }

    res.json({
      success: true,
      message: `"${meal_name}" reçetesi başarıyla güncellendi.`,
      data: recipe
    });

  } catch (err) {
    console.error('[PUT recipes HATA]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── DELETE /api/recipes/:id ──────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const rid = parseInt(req.params.id, 10);

    // meal_plans bağlı mı kontrol et
    const { data: plans } = await supabase
      .from('meal_plans')
      .select('id')
      .eq('recipe_id', rid)
      .limit(1);

    if (plans && plans.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'Bu reçete bir meal_plan kaydına bağlı, silinemez.'
      });
    }

    // Önce içerikleri sil (CASCADE varsa otomatik olur ama her ihtimale karşı)
    await supabase.from('recipe_ingredients').delete().eq('recipe_id', rid);
    const { error } = await supabase.from('recipes').delete().eq('id', rid);
    if (error) throw error;

    res.json({ success: true, message: 'Reçete ve içerikleri silindi.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
