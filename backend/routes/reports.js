/**
 * AKŞAM RAPORU ROUTE'U (3 ÖĞÜNLÜ SİSTEM)
 * =======================================
 * Kahvaltı, Öğle Yemeği, İkindi Kahvaltısı
 *
 * GET /api/evening-report
 * GET /api/evening-report?date=YYYY-MM-DD
 *
 * İşlev:
 *   1. O günkü stock_transactions tablosundaki 'out' kayıtlarını hem
 *      öğün bazında ('kahvalti', 'ogle', 'ikindi') gruplar hem de günlük konsolide toplar.
 *   2. current_stock ile birleştirerek her malzemenin giden ve kalan miktarlarını listeler.
 *   3. Kritik seviyenin (critical_threshold) altındaki ürünleri işaretler.
 *   4. Haftalık ortalamaya göre normalden fazla/az tüketilen ürünleri belirtir.
 */

const express  = require('express');
const router   = express.Router();
const supabase = require('../supabase');

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

router.get('/', async (req, res) => {
  try {
    const targetDate = req.query.date || new Date().toISOString().split('T')[0];
    const dayOfWeek  = getDayOfWeek(targetDate);
    const dayName    = GUN_ADLARI[dayOfWeek] || 'Bilinmeyen Gün';

    // ── 1. O günkü meal_plans (öğünler) kayıtlarını getir ───────────────────
    const { data: todayMeals, error: mealErr } = await supabase
      .from('meal_plans')
      .select(`
        id,
        meal_type,
        portion_count,
        recipes (
          id,
          meal_name,
          meal_type
        )
      `)
      .eq('plan_date', targetDate);

    if (mealErr) throw mealErr;

    const mealPlansMap = {};
    (todayMeals || []).forEach(m => {
      mealPlansMap[m.id] = {
        meal_plan_id:  m.id,
        meal_type:     m.meal_type || 'ogle',
        meal_label:    OGUN_ISIMLERI[m.meal_type] || m.meal_type,
        recipe_id:     m.recipes?.id,
        recipe_name:   m.recipes?.meal_name || 'Bilinmeyen Yemek',
        portion_count: m.portion_count,
        items:         []
      };
    });

    // ── 2. O günkü 'out' stok hareketlerini getir ───────────────────────────
    const { data: outTxs, error: txErr } = await supabase
      .from('stock_transactions')
      .select(`
        id,
        product_id,
        quantity,
        transaction_date,
        source_type,
        source_id,
        products (
          id,
          name,
          unit,
          category,
          critical_threshold
        )
      `)
      .eq('transaction_type', 'out')
      .eq('transaction_date', targetDate);

    if (txErr) throw txErr;

    // ── 3. Güncel stok durumunu getir ────────────────────────────────────────
    const { data: currentStockRows, error: stockErr } = await supabase
      .from('current_stock')
      .select(`
        product_id,
        quantity,
        products (
          id,
          name,
          unit,
          category,
          critical_threshold
        )
      `);

    if (stockErr) throw stockErr;

    const stockMap = {};
    const allProductsStock = {};
    (currentStockRows || []).forEach(row => {
      const q = parseFloat(row.quantity);
      stockMap[row.product_id] = q;
      allProductsStock[row.product_id] = {
        product_id:         row.product_id,
        name:               row.products?.name,
        unit:               row.products?.unit,
        category:           row.products?.category,
        quantity:           q,
        critical_threshold: parseFloat(row.products?.critical_threshold || 0),
        is_critical:        q <= parseFloat(row.products?.critical_threshold || 0)
      };
    });

    // ── 4. Hareketleri öğünlere ve genel toplama dağıt ──────────────────────
    const consolidatedMap = {};

    (outTxs || []).forEach(tx => {
      const pid   = tx.product_id;
      const qty   = parseFloat(tx.quantity);
      const p     = tx.products;
      const pName = p?.name || `Ürün #${pid}`;
      const pUnit = p?.unit || 'adet';
      const pCat  = p?.category || 'genel';
      const pCrit = parseFloat(p?.critical_threshold || 0);

      // Öğün bazlı dağıtım
      if (tx.source_type === 'meal_plan' && tx.source_id && mealPlansMap[tx.source_id]) {
        mealPlansMap[tx.source_id].items.push({
          product_id: pid,
          name:       pName,
          unit:       pUnit,
          quantity:   round4(qty)
        });
      }

      // Günlük konsolide toplam
      if (!consolidatedMap[pid]) {
        consolidatedMap[pid] = {
          product_id:         pid,
          product_name:       pName,
          category:           pCat,
          unit:               pUnit,
          critical_threshold: pCrit,
          daily_consumed:     0
        };
      }
      consolidatedMap[pid].daily_consumed = round4(consolidatedMap[pid].daily_consumed + qty);
    });

    // Öğün dökümünü düzenle
    const mealsBreakdown = {};
    OGUN_SIRASI.forEach(key => {
      mealsBreakdown[key] = [];
    });

    Object.values(mealPlansMap).forEach(m => {
      const k = m.meal_type || 'ogle';
      if (!mealsBreakdown[k]) mealsBreakdown[k] = [];
      mealsBreakdown[k].push(m);
    });

    // ── 5. Haftalık ortalama referansı hesapla ──────────────────────────────
    const avgPortionsToday = (todayMeals && todayMeals.length > 0)
      ? Math.round(todayMeals.reduce((acc, m) => acc + m.portion_count, 0) / todayMeals.length)
      : 70;

    const weeklyBaselines = await calculateWeeklyBaselines(targetDate, avgPortionsToday, dayOfWeek);

    // ── 6. Konsolide ürün detaylarını hazırla ────────────────────────────────
    const consumedItems = Object.values(consolidatedMap).map(item => {
      const consumedQty = round4(item.daily_consumed);
      const remaining   = round4(stockMap[item.product_id] ?? 0);
      const isCritical  = remaining <= item.critical_threshold;

      const baselineInfo = weeklyBaselines[item.product_id] || {
        average: consumedQty,
        source: 'gunluk_tuketim'
      };

      const refAvg = round4(baselineInfo.average);
      const diff   = round4(consumedQty - refAvg);

      let diffPercent = 0;
      if (refAvg > 0) {
        diffPercent = round1(((consumedQty - refAvg) / refAvg) * 100);
      }

      let consumptionStatus = 'normal';
      let statusLabel       = 'Normal Seviyede';
      let statusIcon        = '✅';

      if (diffPercent > 15) {
        consumptionStatus = 'normalden_fazla';
        statusLabel       = `Normalden %${Math.abs(diffPercent)} Fazla`;
        statusIcon        = '🔺';
      } else if (diffPercent < -15) {
        consumptionStatus = 'normalden_az';
        statusLabel       = `Normalden %${Math.abs(diffPercent)} Az`;
        statusIcon        = '🔻';
      }

      return {
        product_id:         item.product_id,
        product_name:       item.product_name,
        category:           item.category,
        unit:               item.unit,
        daily_consumed:     consumedQty,
        current_stock:      remaining,
        critical_threshold: item.critical_threshold,
        is_critical:        isCritical,
        stock_status:       isCritical ? 'KRİTİK' : (remaining <= item.critical_threshold * 1.5 ? 'YAKLAŞIYOR' : 'YETERLİ'),
        weekly_avg:         refAvg,
        difference:         diff,
        difference_percent: diffPercent,
        consumption_status: consumptionStatus,
        status_label:       statusLabel,
        status_icon:        statusIcon,
        baseline_source:    baselineInfo.source
      };
    });

    consumedItems.sort((a, b) => (b.is_critical - a.is_critical) || (b.daily_consumed - a.daily_consumed));

    const aboveNormal = consumedItems.filter(i => i.consumption_status === 'normalden_fazla');
    const belowNormal = consumedItems.filter(i => i.consumption_status === 'normalden_az');
    const normalItems = consumedItems.filter(i => i.consumption_status === 'normal');

    const allCriticalItems = Object.values(allProductsStock).filter(p => p.is_critical);

    // ── 7. Yanıt ─────────────────────────────────────────────────────────────
    res.json({
      success:     true,
      report_date: targetDate,
      day_name:    dayName,
      summary: {
        total_products_consumed: consumedItems.length,
        critical_consumed_count: consumedItems.filter(i => i.is_critical).length,
        above_normal_count:      aboveNormal.length,
        below_normal_count:      belowNormal.length,
        normal_count:            normalItems.length,
        total_meals_cooked:      todayMeals?.length || 0,
        overall_critical_count:  allCriticalItems.length
      },
      // 3 Öğün Bazında Gruplandırılmış Döküm
      meals_breakdown: {
        kahvalti: mealsBreakdown.kahvalti || [],
        ogle:     mealsBreakdown.ogle || [],
        ikindi:   mealsBreakdown.ikindi || []
      },
      // Günlük Toplam Konsolide Tüketim Tablosu
      consumed_items: consumedItems,
      consumption_analysis: {
        above_normal: aboveNormal.map(i => ({
          product_name: i.product_name,
          unit: i.unit,
          consumed: i.daily_consumed,
          weekly_avg: i.weekly_avg,
          diff_percent: `+${i.difference_percent}%`
        })),
        below_normal: belowNormal.map(i => ({
          product_name: i.product_name,
          unit: i.unit,
          consumed: i.daily_consumed,
          weekly_avg: i.weekly_avg,
          diff_percent: `${i.difference_percent}%`
        })),
        normal: normalItems.map(i => ({
          product_name: i.product_name,
          unit: i.unit,
          consumed: i.daily_consumed,
          weekly_avg: i.weekly_avg
        }))
      },
      critical_stock_alerts: allCriticalItems.map(p => ({
        product_id:         p.product_id,
        name:               p.name,
        current_quantity:   p.quantity,
        unit:               p.unit,
        critical_threshold: p.critical_threshold,
        warning:            `⚠️ ${p.name}: Mevcut stok (${p.quantity} ${p.unit}) kritik eşiğin (${p.critical_threshold} ${p.unit}) altında!`
      }))
    });

  } catch (err) {
    console.error('[evening-report HATA]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

async function calculateWeeklyBaselines(targetDate, portionCount, dayOfWeek) {
  const baselines = {};

  try {
    const d = new Date(targetDate);
    d.setDate(d.getDate() - 7);
    const startDate = d.toISOString().split('T')[0];

    const { data: pastTxs } = await supabase
      .from('stock_transactions')
      .select('product_id, quantity, transaction_date')
      .eq('transaction_type', 'out')
      .gte('transaction_date', startDate)
      .lt('transaction_date', targetDate);

    const pastDaysMap = {};
    const productSums = {};
    (pastTxs || []).forEach(tx => {
      pastDaysMap[tx.transaction_date] = true;
      productSums[tx.product_id] = (productSums[tx.product_id] || 0) + parseFloat(tx.quantity);
    });

    const distinctPastDays = Object.keys(pastDaysMap).length;

    if (distinctPastDays > 0) {
      Object.keys(productSums).forEach(pid => {
        baselines[pid] = {
          average: round4(productSums[pid] / distinctPastDays),
          source: 'gecmis_hareketler'
        };
      });
    }

    // 3 öğünlü menü reçetelerinden standart tüketim hesapla
    const { data: menuData } = await supabase
      .from('weekly_menu')
      .select(`
        day_of_week,
        meal_type,
        recipes (
          id,
          meal_name,
          recipe_ingredients (
            product_id,
            quantity_per_portion
          )
        )
      `)
      .eq('day_of_week', dayOfWeek);

    if (menuData) {
      menuData.forEach(menu => {
        const ingredients = menu.recipes?.recipe_ingredients || [];
        ingredients.forEach(ri => {
          const pid = ri.product_id;
          const expected = parseFloat(ri.quantity_per_portion) * portionCount;
          baselines[pid] = {
            average: round4((baselines[pid]?.average || 0) + expected),
            source: 'recete_standardi'
          };
        });
      });
    }

  } catch (err) {
    console.warn('[calculateWeeklyBaselines]', err.message);
  }

  return baselines;
}

function getDayOfWeek(dateStr) {
  const d = new Date(dateStr);
  const jsDay = d.getUTCDay();
  return jsDay === 0 ? 7 : jsDay;
}

function round4(num) {
  return parseFloat((Number(num) || 0).toFixed(4));
}

function round1(num) {
  return parseFloat((Number(num) || 0).toFixed(1));
}

module.exports = router;
