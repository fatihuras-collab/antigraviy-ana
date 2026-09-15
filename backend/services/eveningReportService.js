/**
 * AKŞAM RAPORU SERVİSİ
 * =====================
 * Günlük tüketim, mevcut stok durumu ve kritik stok verilerini toplayarak
 * akşam raporu oluşturur ve Telegram üzerinden iletir.
 */

const supabase = require('../supabase');
const { sendTelegramMessage } = require('./telegramService');
const { getPrice } = require('./productPriceService');

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

/**
 * Türkiye (Europe/Istanbul) saat diliminde bugünün YYYY-MM-DD tarihini döner.
 */
function getTodayDateTurkey() {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return formatter.format(new Date());
}

/**
 * YYYY-MM-DD -> DD.MM.YYYY
 */
function formatDateDisplay(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}.${parts[1]}.${parts[0]}`;
  }
  return dateStr;
}

function formatQuantity(val) {
  const n = parseFloat(val);
  if (isNaN(n)) return '0';
  return Number(n.toFixed(2)).toString();
}

function round4(num) {
  return parseFloat((Number(num) || 0).toFixed(4));
}

function round2(num) {
  return parseFloat((Number(num) || 0).toFixed(2));
}

function round1(num) {
  return parseFloat((Number(num) || 0).toFixed(1));
}

function getDayOfWeek(dateStr) {
  const d = new Date(dateStr);
  const jsDay = d.getUTCDay();
  return jsDay === 0 ? 7 : jsDay;
}

/**
 * Belirtilen gün için akşam raporu verilerini hazırlar.
 * @param {string} [date] - YYYY-MM-DD formatında tarih (varsayılan: Türkiye saatiyle bugün)
 */
async function generateEveningReportData(date) {
  const targetDate = date || getTodayDateTurkey();
  const dayOfWeek  = getDayOfWeek(targetDate);
  const dayName    = GUN_ADLARI[dayOfWeek] || 'Bilinmeyen Gün';

  // 1. O günkü meal_plans (öğünler) kayıtlarını getir
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

  // 2. Günün 'out' stok hareketlerini getir
  let todayTxs = [];
  let { data: txData, error: txErr } = await supabase
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
        critical_threshold,
        unit_price
      )
    `)
    .eq('transaction_type', 'out')
    .eq('transaction_date', targetDate);

  if (txErr && (txErr.code === '42703' || txErr.message?.includes('unit_price'))) {
    const retry = await supabase
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
    txData = retry.data;
    txErr = retry.error;
  }
  if (txErr) throw txErr;
  todayTxs = txData || [];
  const outTxs = todayTxs;

  // 3. Güncel stok durumunu getir
  let currentStockRows = [];
  let { data: stockData, error: stockErr } = await supabase
    .from('current_stock')
    .select(`
      product_id,
      quantity,
      products (
        id,
        name,
        unit,
        category,
        critical_threshold,
        unit_price
      )
    `);

  if (stockErr && (stockErr.code === '42703' || stockErr.message?.includes('unit_price'))) {
    const retryStock = await supabase
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
    stockData = retryStock.data;
    stockErr = retryStock.error;
  }
  if (stockErr) throw stockErr;
  currentStockRows = stockData || [];

  const stockMap = {};
  const allProductsStock = {};
  (currentStockRows || []).forEach(row => {
    const q = parseFloat(row.quantity);
    const critThreshold = parseFloat(row.products?.critical_threshold || 0);
    const uPrice = (row.products?.unit_price != null && !isNaN(parseFloat(row.products.unit_price)) && parseFloat(row.products.unit_price) > 0)
      ? parseFloat(row.products.unit_price)
      : getPrice(row.product_id, row.products?.name);
    stockMap[row.product_id] = q;
    allProductsStock[row.product_id] = {
      product_id:         row.product_id,
      name:               row.products?.name,
      unit:               row.products?.unit,
      category:           row.products?.category,
      quantity:           q,
      critical_threshold: critThreshold,
      unit_price:         uPrice,
      is_critical:        critThreshold > 0 && q <= critThreshold
    };
  });

  // 4. Hareketleri konsolide et ve öğünlere dağıt
  const consolidatedMap = {};

  (outTxs || []).forEach(tx => {
    const pid   = tx.product_id;
    const qty   = parseFloat(tx.quantity);
    const p     = tx.products;
    const pName = p?.name || `Ürün #${pid}`;
    const pUnit = p?.unit || 'adet';
    const pCat  = p?.category || 'genel';
    const pCrit = parseFloat(p?.critical_threshold || 0);
    const pPrice = (p?.unit_price != null && !isNaN(parseFloat(p.unit_price)) && parseFloat(p.unit_price) > 0)
      ? parseFloat(p.unit_price)
      : getPrice(pid, pName);

    if (tx.source_type === 'meal_plan' && tx.source_id && mealPlansMap[tx.source_id]) {
      mealPlansMap[tx.source_id].items.push({
        product_id: pid,
        name:       pName,
        unit:       pUnit,
        quantity:   round4(qty)
      });
    }

    if (!consolidatedMap[pid]) {
      consolidatedMap[pid] = {
        product_id:         pid,
        product_name:       pName,
        category:           pCat,
        unit:               pUnit,
        critical_threshold: pCrit,
        unit_price:         pPrice,
        daily_consumed:     0
      };
    }
    consolidatedMap[pid].daily_consumed = round4(consolidatedMap[pid].daily_consumed + qty);
  });

  const mealsBreakdown = {};
  OGUN_SIRASI.forEach(key => {
    mealsBreakdown[key] = [];
  });

  Object.values(mealPlansMap).forEach(m => {
    const k = m.meal_type || 'ogle';
    if (!mealsBreakdown[k]) mealsBreakdown[k] = [];
    mealsBreakdown[k].push(m);
  });

  // Öğrenci sayısı (Bugün kaç öğrenci için yemek çıktı)
  let studentCount = 0;
  if (todayMeals && todayMeals.length > 0) {
    studentCount = Math.max(...todayMeals.map(m => m.portion_count || 0));
  }

  const avgPortionsToday = studentCount > 0 ? studentCount : 70;
  const weeklyBaselines = await calculateWeeklyBaselines(targetDate, avgPortionsToday, dayOfWeek);

  // 5. Konsolide ürün detaylarını ve maliyeti hazırla
  let totalDailyCost = 0;
  const missingPriceProducts = [];

  const consumedItems = Object.values(consolidatedMap).map(item => {
    const consumedQty = round4(item.daily_consumed);
    const remaining   = round4(stockMap[item.product_id] ?? 0);
    const isCritical  = item.critical_threshold > 0 && remaining <= item.critical_threshold;
    const unitPrice   = item.unit_price;

    let itemCost = null;
    if (unitPrice != null) {
      itemCost = round2(consumedQty * unitPrice);
      totalDailyCost = round2(totalDailyCost + itemCost);
    } else {
      missingPriceProducts.push(item.product_name);
    }

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
      unit_price:         unitPrice,
      item_cost:          itemCost,
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

  consumedItems.sort((a, b) => (b.daily_consumed - a.daily_consumed));

  const aboveNormal = consumedItems.filter(i => i.consumption_status === 'normalden_fazla');
  const belowNormal = consumedItems.filter(i => i.consumption_status === 'normalden_az');
  const normalItems = consumedItems.filter(i => i.consumption_status === 'normal');

  const allCriticalItems = Object.values(allProductsStock).filter(p => p.is_critical);

  return {
    success:     true,
    report_date: targetDate,
    day_name:    dayName,
    student_count: studentCount,
    today_meals: todayMeals || [],
    summary: {
      student_count:           studentCount,
      total_products_consumed: consumedItems.length,
      critical_consumed_count: consumedItems.filter(i => i.is_critical).length,
      above_normal_count:      aboveNormal.length,
      below_normal_count:      belowNormal.length,
      normal_count:            normalItems.length,
      total_meals_cooked:      todayMeals?.length || 0,
      overall_critical_count:  allCriticalItems.length
    },
    meals_breakdown: {
      kahvalti: mealsBreakdown.kahvalti || [],
      ogle:     mealsBreakdown.ogle || [],
      ikindi:   mealsBreakdown.ikindi || []
    },
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
    })),
    total_cost:             totalDailyCost,
    missing_price_products: missingPriceProducts,
    missing_price_warning:  missingPriceProducts.length > 0
      ? `Şu ürünlerin fiyatı girilmemiş, maliyet eksik olabilir: ${missingPriceProducts.join(', ')}`
      : null
  };
}

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

/**
 * Akşam raporu verisini okunaklı Telegram mesajına dönüştürür.
 * Format:
 * 📊 [tarih] Akşam Raporu
 * Bugün [X] öğrenci için yemek çıktı (Toplam maliyet: ~[Y] TL).
 * En çok tüketilenler: [ürün - miktar, ...]
 * ⚠️ Kritik seviyedekiler: [ürün - kalan miktar, ...]
 * (veya kritik yoksa: 'Kritik ürün yok, her şey yolunda.')
 * ⚠️ Şu ürünlerin fiyatı girilmemiş, maliyet eksik olabilir: [liste] (varsa)
 */
function formatEveningReportMessage(reportData) {
  const dateFormatted = formatDateDisplay(reportData.report_date);
  const studentCount  = reportData.student_count ?? 0;
  const totalCost     = reportData.total_cost ?? 0;
  const formattedCost = totalCost.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // En çok tüketilenler
  const consumed = reportData.consumed_items || [];
  const topConsumed = [...consumed].sort((a, b) => (b.daily_consumed || 0) - (a.daily_consumed || 0));

  let consumedLine = 'En çok tüketilenler: ';
  if (topConsumed.length > 0) {
    consumedLine += topConsumed
      .slice(0, 10)
      .map(i => `${i.product_name} - ${formatQuantity(i.daily_consumed)} ${i.unit || 'adet'}`)
      .join(', ');
  } else {
    consumedLine += 'Bugün tüketim kaydı yok';
  }

  // Kritik seviyedekiler
  const criticalItems = reportData.critical_stock_alerts || [];
  let criticalLine = '';
  if (criticalItems.length > 0) {
    const listStr = criticalItems
      .map(i => `${i.name} - ${formatQuantity(i.current_quantity)} ${i.unit || 'adet'}`)
      .join(', ');
    criticalLine = `⚠️ Kritik seviyedekiler: ${listStr}`;
  } else {
    criticalLine = 'Kritik ürün yok, her şey yolunda.';
  }

  const lines = [
    `📊 ${dateFormatted} Akşam Raporu`,
    `Bugün ${studentCount} öğrenci için yemek çıktı (Toplam maliyet: ~${formattedCost} TL).`,
    consumedLine,
    criticalLine
  ];

  if (reportData.missing_price_products && reportData.missing_price_products.length > 0) {
    lines.push(`⚠️ Şu ürünlerin fiyatı girilmemiş, maliyet eksik olabilir: ${reportData.missing_price_products.join(', ')}`);
  }

  return lines.join('\n');
}

/**
 * Akşam raporunu oluşturup doğrudan Telegram'a gönderir.
 * @param {string} [date] - Opsiyonel YYYY-MM-DD
 */
async function sendEveningReportTelegram(date) {
  const reportData = await generateEveningReportData(date);
  const messageText = formatEveningReportMessage(reportData);

  console.log('[EveningReport] Telegram mesajı hazırlanıyor:');
  console.log(messageText);

  const telegramResult = await sendTelegramMessage(messageText);

  return {
    success: telegramResult.success,
    reason: telegramResult.reason,
    error: telegramResult.error,
    message_text: messageText,
    data: reportData,
    telegram_result: telegramResult
  };
}

module.exports = {
  getTodayDateTurkey,
  formatDateDisplay,
  formatQuantity,
  generateEveningReportData,
  formatEveningReportMessage,
  sendEveningReportTelegram
};
