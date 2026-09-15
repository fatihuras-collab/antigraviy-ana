/**
 * GÜNLÜK TÜKETİM ROUTE'U (3 ÖĞÜNLÜ SİSTEM)
 * ========================================
 * Kahvaltı, Öğle Yemeği, İkindi Kahvaltısı
 *
 * POST /api/daily-consumption
 * Body:
 *   { "portion_count": 70 }              — zorunlu: kaç öğrenci için pişiriliyor
 *   { "portion_count": 70, "date": "2026-09-11" } — opsiyonel: tarih (varsayılan: bugün)
 *
 * Akış:
 *   1. O günkü haftanın gününü bul (1=Pzt … 5=Cum)
 *   2. Tekrar girişi engelle: O gün için meal_plans kaydı varsa 409 döndür
 *   3. weekly_menu'den o günün 3 öğününü ('kahvalti', 'ogle', 'ikindi') ve reçetelerini getir
 *   4. Tüm öğünlerin toplam malzeme ihtiyacını hesapla ve toplu stok kontrolü yap
 *   5. Yeterli stok varsa her öğün için meal_plans ve stock_transactions kayıtlarını oluştur
 *   6. Öğün bazında ve konsolide stok özetini döndür
 *
 * DELETE /api/daily-consumption
 * DELETE /api/daily-consumption/:date
 *   - O günkü tüm öğünlerin kayıtlarını iptal eder ve stokları geri iade eder.
 */

const express  = require('express');
const router   = express.Router();
const supabase = require('../supabase');
const { checkStockAlerts } = require('../services/stockAlertService');

const GUN_ADLARI = {
  1: 'Pazartesi', 2: 'Salı', 3: 'Çarşamba',
  4: 'Perşembe',  5: 'Cuma', 6: 'Cumartesi', 7: 'Pazar'
};

const OGUN_SIRASI   = ['kahvalti', 'ogle', 'ikindi'];
const OGUN_ISIMLERI = {
  kahvalti: 'Kahvaltı',
  ogle:     'Öğle Yemeği',
  ikindi:   'İkindi Kahvaltısı'
};

const WEEK_BASE_DATES = {
  1: '2026-09-07',
  2: '2026-09-14',
  3: '2026-09-21',
  4: '2026-09-28'
};

// ─── POST /api/daily-consumption ─────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { portion_count, date } = req.body;

    // ── 1. Validasyon ─────────────────────────────────────────────────────────
    if (!portion_count) {
      return res.status(400).json({
        success: false,
        error: 'portion_count zorunludur. (kaç öğrenci için pişiriliyor?)'
      });
    }

    const count = parseInt(portion_count, 10);
    if (isNaN(count) || count <= 0) {
      return res.status(400).json({
        success: false,
        error: 'portion_count sıfırdan büyük bir tam sayı olmalıdır.'
      });
    }

    // ── 2. Tarih ve gün hesapla ───────────────────────────────────────────────
    const targetDate = date || new Date().toISOString().split('T')[0];
    const dayOfWeek  = getDayOfWeek(targetDate);
    const dayName    = GUN_ADLARI[dayOfWeek] || 'Bilinmeyen Gün';

    // ── 2.1. Tekrar girişi engelle ───────────────────────────────────────────
    const { data: existingPlans, error: checkErr } = await supabase
      .from('meal_plans')
      .select(`
        id,
        plan_date,
        portion_count,
        meal_type,
        recipes (
          id,
          meal_name
        )
      `)
      .eq('plan_date', targetDate);

    if (checkErr) throw checkErr;

    if (existingPlans && existingPlans.length > 0) {
      return res.status(409).json({
        success: false,
        error: `${targetDate} (${dayName}) tarihi için günlük tüketim zaten işlenmiş. Tekrar işlenemez.`,
        existing_plans: existingPlans.map(p => ({
          meal_plan_id:  p.id,
          meal_type:     p.meal_type || 'ogle',
          meal_label:    OGUN_ISIMLERI[p.meal_type] || p.meal_type,
          recipe_name:   p.recipes?.meal_name,
          portion_count: p.portion_count
        }))
      });
    }

    // ── 3. O güne ait menü öğünlerini getir ───────────────────────────────────
    // ÖNCELİK 1: monthly_menu tablosunda o tarih (targetDate) için kayıt var mı?
    let menuRows = null;
    try {
      const { data: mRows, error: mErr } = await supabase
        .from('monthly_menu')
        .select(`
          id,
          meal_type,
          date,
          recipes (
            id,
            meal_name,
            meal_type,
            recipe_ingredients (
              id,
              product_id,
              quantity_per_portion,
              products (
                id,
                name,
                unit,
                critical_threshold
              )
            )
          )
        `)
        .eq('date', targetDate);

      if (!mErr && mRows && mRows.length > 0) {
        menuRows = mRows;
      }
    } catch (e) {
      // monthly_menu henüz yoksa weekly_menu fallback kullanılır
    }

    // ÖNCELİK 2: monthly_menu'de bulunamazsa weekly_menu fallback
    if (!menuRows || menuRows.length === 0) {
      let weekNum = req.body.week_number;
      if (!weekNum) {
        if (targetDate >= '2026-09-28') weekNum = 4;
        else if (targetDate >= '2026-09-21') weekNum = 3;
        else if (targetDate >= '2026-09-14') weekNum = 2;
        else weekNum = 1;
      }

      let { data: wRows, error: menuErr } = await supabase
        .from('weekly_menu')
        .select(`
          id,
          day_of_week,
          meal_type,
          valid_from,
          valid_to,
          recipes (
            id,
            meal_name,
            meal_type,
            recipe_ingredients (
              id,
              product_id,
              quantity_per_portion,
              products (
                id,
                name,
                unit,
                critical_threshold
              )
            )
          )
        `)
        .eq('day_of_week', dayOfWeek)
        .lte('valid_from', targetDate)
        .or(`valid_to.is.null,valid_to.gte.${targetDate}`);

      if (menuErr) throw menuErr;
      menuRows = wRows;

      // Eğer doğrudan tarih aralığında bulunamazsa, ayın haftasına göre (weekNum) getir
      if (!menuRows || menuRows.length === 0) {
        const targetValidFrom = WEEK_BASE_DATES[weekNum] || '2026-09-07';
        const { data: fbRows, error: fbErr } = await supabase
          .from('weekly_menu')
          .select(`
            id,
            day_of_week,
            meal_type,
            valid_from,
            valid_to,
            recipes (
              id,
              meal_name,
              meal_type,
              recipe_ingredients (
                id,
                product_id,
                quantity_per_portion,
                products (
                  id,
                  name,
                  unit,
                  critical_threshold
                )
              )
            )
          `)
          .eq('day_of_week', dayOfWeek)
          .eq('valid_from', targetValidFrom);

        if (fbErr) throw fbErr;
        menuRows = fbRows;
      }
    }

    if (!menuRows || menuRows.length === 0) {
      const weekendNote = (dayOfWeek === 6 || dayOfWeek === 7) ? ' Hafta sonu yemekhane kapalıdır.' : '';
      return res.status(404).json({
        success: false,
        error: `${dayName} (${targetDate}) için yemek listesinde kayıt bulunamadı.${weekendNote}`,
        day_of_week: dayOfWeek,
        day_name:    dayName
      });
    }

    // Menüleri öğün sırasına göre diz (kahvaltı, öğle, ikindi)
    menuRows.sort((a, b) => {
      const idxA = OGUN_SIRASI.indexOf(a.meal_type ?? 'ogle');
      const idxB = OGUN_SIRASI.indexOf(b.meal_type ?? 'ogle');
      return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);
    });

    // ── 4. Günlük toplam malzeme ihtiyacını topla & stok kontrolü ─────────────
    const consolidatedNeeded = {};
    const mealBreakdowns     = [];

    for (const menu of menuRows) {
      const recipe      = menu.recipes;
      const mType       = menu.meal_type || recipe?.meal_type || 'ogle';
      const ingredients = recipe?.recipe_ingredients || [];

      const mealItems = [];

      for (const ing of ingredients) {
        const pid      = ing.product_id;
        const pName    = ing.products?.name || `Ürün #${pid}`;
        const pUnit    = ing.products?.unit || 'adet';
        const pCrit    = parseFloat(ing.products?.critical_threshold || 0);
        const needed   = round4(parseFloat(ing.quantity_per_portion) * count);

        mealItems.push({
          product_id: pid,
          name:       pName,
          unit:       pUnit,
          needed:     needed
        });

        if (!consolidatedNeeded[pid]) {
          consolidatedNeeded[pid] = {
            product_id:         pid,
            name:               pName,
            unit:               pUnit,
            critical_threshold: pCrit,
            total_needed:       0
          };
        }
        consolidatedNeeded[pid].total_needed = round4(consolidatedNeeded[pid].total_needed + needed);
      }

      mealBreakdowns.push({
        menu_id:    menu.id,
        meal_type:  mType,
        meal_label: OGUN_ISIMLERI[mType] || mType,
        recipe_id:  recipe.id,
        meal_name:  recipe.meal_name,
        items:      mealItems
      });
    }

    // Stokları kontrol et
    const allProductIds = Object.keys(consolidatedNeeded).map(Number);
    const { data: stockRows, error: stockErr } = await supabase
      .from('current_stock')
      .select('product_id, quantity')
      .in('product_id', allProductIds);

    if (stockErr) throw stockErr;

    const stockBeforeMap = {};
    (stockRows || []).forEach(s => { stockBeforeMap[s.product_id] = parseFloat(s.quantity); });

    // Yetersiz stok kontrolü
    const insufficient = [];
    Object.values(consolidatedNeeded).forEach(c => {
      const current = stockBeforeMap[c.product_id] ?? 0;
      if (current < c.total_needed) {
        insufficient.push({
          product_id: c.product_id,
          name:       c.name,
          unit:       c.unit,
          needed:     c.total_needed,
          available:  current,
          missing:    round4(c.total_needed - current)
        });
      }
    });

    if (insufficient.length > 0) {
      return res.status(409).json({
        success: false,
        error: '3 öğünün toplam malzeme ihtiyacı için depoda yeterli stok yok. İşlem iptal edildi.',
        insufficient
      });
    }

    // ── 5. Her öğün için meal_plans ve stock_transactions kaydı oluştur ───────
    const createdMealsResult = [];

    for (const meal of mealBreakdowns) {
      // 5.1. meal_plans kaydı ekle
      const { data: mealPlan, error: mpErr } = await supabase
        .from('meal_plans')
        .insert([{
          plan_date:     targetDate,
          recipe_id:     meal.recipe_id,
          meal_type:     meal.meal_type,
          portion_count: count
        }])
        .select()
        .single();

      if (mpErr) throw mpErr;

      // 5.2. Bu öğünün malzemeleri için stock_transactions 'out' kayıtları ekle
      const transactions = meal.items.map(item => ({
        product_id:       item.product_id,
        transaction_type: 'out',
        quantity:         item.needed,
        source_type:      'meal_plan',
        source_id:        mealPlan.id,
        transaction_date: targetDate
      }));

      const { error: txErr } = await supabase
        .from('stock_transactions')
        .insert(transactions);

      if (txErr) throw txErr;

      createdMealsResult.push({
        meal_plan_id: mealPlan.id,
        meal_type:    meal.meal_type,
        meal_label:   meal.meal_label,
        recipe: {
          id:   meal.recipe_id,
          name: meal.meal_name
        },
        portion_count: count,
        items: meal.items
      });
    }

    // ── 6. Güncellenmiş stokları ve ürün birim fiyatlarını çek ───────────────
    const { data: updatedStockRows } = await supabase
      .from('current_stock')
      .select('product_id, quantity')
      .in('product_id', allProductIds);

    // Ürünlerin güncel birim fiyatlarını (unit_price) getir
    let productPriceRows = [];
    const { data: priceData, error: priceErr } = await supabase
      .from('products')
      .select('id, name, unit, unit_price')
      .in('id', allProductIds);

    if (!priceErr) {
      productPriceRows = priceData || [];
    }

    const prodPriceMap = {};
    (productPriceRows || []).forEach(p => {
      const price = (p.unit_price != null && !isNaN(parseFloat(p.unit_price)) && parseFloat(p.unit_price) > 0)
        ? parseFloat(p.unit_price)
        : null;
      prodPriceMap[p.id] = price;
    });

    // Stok kritik seviye kontrolü ve Telegram uyarısı
    checkStockAlerts(allProductIds).catch(err => {
      console.error('[Stok Uyarı Hatası - consumption/daily]', err.message);
    });

    const stockAfterMap = {};
    (updatedStockRows || []).forEach(s => { stockAfterMap[s.product_id] = parseFloat(s.quantity); });

    // ── 7. Konsolide özet, maliyet hesabı ve uyarılar ─────────────────────────
    let totalCost = 0;
    const missingPriceProducts = [];

    const consolidatedList = Object.values(consolidatedNeeded).map(c => {
      const before = round4(stockBeforeMap[c.product_id] ?? 0);
      const after  = round4(stockAfterMap[c.product_id] ?? (before - c.total_needed));
      const isCrit = after <= c.critical_threshold;
      const unitPrice = prodPriceMap[c.product_id] ?? null;

      let itemCost = null;
      if (unitPrice != null) {
        itemCost = round2(c.total_needed * unitPrice);
        totalCost = round2(totalCost + itemCost);
      } else {
        missingPriceProducts.push(c.name);
      }

      return {
        product_id:         c.product_id,
        name:               c.name,
        unit:               c.unit,
        consumed:           c.total_needed,
        unit_price:         unitPrice,
        item_cost:          itemCost,
        stock_before:       before,
        stock_after:        after,
        critical_threshold: c.critical_threshold,
        is_critical:        isCrit
      };
    });

    const warnings = consolidatedList
      .filter(c => c.is_critical || c.stock_after < 5)
      .map(c => `⚠️ ${c.name}: stok ${c.stock_after} ${c.unit}'ye düştü (Kritik eşik: ${c.critical_threshold})`);

    const formattedCost = totalCost.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const costSummaryText = `Bugün ${count} öğrenci için toplam ~${formattedCost} TL'lik malzeme kullanıldı.`;
    const missingPriceWarning = missingPriceProducts.length > 0
      ? `Şu ürünlerin fiyatı girilmemiş, maliyet eksik olabilir: ${missingPriceProducts.join(', ')}`
      : null;

    res.status(201).json({
      success:               true,
      message:               `${dayName} gününün 3 öğünü işlendi (Kahvaltı, Öğle, İkindi) — ${count} porsiyon`,
      date:                  targetDate,
      day_name:              dayName,
      portion_count:         count,
      total_cost:            totalCost,
      cost_summary:          costSummaryText,
      missing_price_products: missingPriceProducts,
      missing_price_warning:  missingPriceWarning,
      cost_analysis: {
        total_cost:             totalCost,
        total_cost_formatted:   `${formattedCost} TL`,
        summary_text:           costSummaryText,
        missing_price_products: missingPriceProducts,
        missing_price_warning:  missingPriceWarning
      },
      meals:                 createdMealsResult,
      consumption:           consolidatedList,
      warnings:              warnings
    });

  } catch (err) {
    console.error('[daily-consumption HATA]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── DELETE /api/daily-consumption & DELETE /api/daily-consumption/:date ─────
// Belirli bir günün 3 öğünlük tüketim kayıtlarını iptal eder ve stokları iade eder.
const cancelConsumptionHandler = async (req, res) => {
  try {
    const targetDate = req.params.date || req.query.date || new Date().toISOString().split('T')[0];

    // 1. O güne ait meal_plans kayıtlarını bul
    const { data: plans, error: pErr } = await supabase
      .from('meal_plans')
      .select('id, meal_type, portion_count, recipes(meal_name)')
      .eq('plan_date', targetDate);

    if (pErr) throw pErr;

    if (!plans || plans.length === 0) {
      return res.status(404).json({
        success: false,
        error: `${targetDate} tarihi için silinecek bir tüketim kaydı bulunamadı.`
      });
    }

    // 2. O güne ait 'out' stock_transactions kayıtlarını bul
    const { data: txs, error: txErr } = await supabase
      .from('stock_transactions')
      .select('id, product_id, quantity')
      .eq('transaction_type', 'out')
      .eq('transaction_date', targetDate)
      .eq('source_type', 'meal_plan');

    if (txErr) throw txErr;

    // 3. Stokları geri iade et
    for (const tx of (txs || [])) {
      const { data: cur } = await supabase
        .from('current_stock')
        .select('quantity')
        .eq('product_id', tx.product_id)
        .single();

      if (cur) {
        await supabase
          .from('current_stock')
          .update({
            quantity: round4(parseFloat(cur.quantity) + parseFloat(tx.quantity)),
            last_updated: new Date().toISOString()
          })
          .eq('product_id', tx.product_id);
      }
    }

    // 4. stock_transactions ve meal_plans kayıtlarını sil
    if (txs && txs.length > 0) {
      await supabase
        .from('stock_transactions')
        .delete()
        .in('id', txs.map(t => t.id));
    }

    await supabase
      .from('meal_plans')
      .delete()
      .eq('plan_date', targetDate);

    // İptal edilen ürünlerin stokları iade edildiği için kritik durum kontrolü (eşik üstüne çıkanlar sıfırlanır)
    const cancelledProductIds = (txs || []).map(t => t.product_id);
    if (cancelledProductIds.length > 0) {
      checkStockAlerts(cancelledProductIds).catch(err => {
        console.error('[Stok Uyarı Hatası - consumption/cancel]', err.message);
      });
    }

    res.json({
      success: true,
      message: `${targetDate} tarihindeki 3 öğünlük tüketim kayıtları iptal edildi ve stoklar geri iade edildi.`,
      cancelled_plans: plans.map(p => ({
        meal_plan_id:  p.id,
        meal_type:     p.meal_type || 'ogle',
        recipe_name:   p.recipes?.meal_name,
        portion_count: p.portion_count
      })),
      refunded_transactions_count: txs?.length || 0
    });

  } catch (err) {
    console.error('[DELETE daily-consumption HATA]', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

router.delete('/', cancelConsumptionHandler);
router.delete('/:date', cancelConsumptionHandler);

function getDayOfWeek(dateStr) {
  const d = new Date(dateStr);
  const jsDay = d.getUTCDay();
  return jsDay === 0 ? 7 : jsDay;
}

function round4(num) {
  return parseFloat((Number(num) || 0).toFixed(4));
}

function round2(num) {
  return parseFloat((Number(num) || 0).toFixed(2));
}

module.exports = router;
