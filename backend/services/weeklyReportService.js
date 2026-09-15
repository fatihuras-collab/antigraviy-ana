/**
 * HAFTALIK GENEL RAPOR SERVİSİ
 * =============================
 * Son 7 günün stok hareketlerini, öğün çıktılarını, en çok tüketilen ürünleri,
 * azalan/kritik ürünleri ve durgun (hareket görmeyen) ürünleri analiz eder,
 * haftalık özet raporunu oluşturur ve Telegram üzerinden iletir.
 */

const supabase = require('../supabase');
const { sendTelegramMessage } = require('./telegramService');

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

/**
 * Bitiş tarihine göre son 7 günlük (dahil) aralığı hesaplar.
 * @param {string} [endDateStr] - YYYY-MM-DD formatında bitiş tarihi
 * @param {string} [startDateStr] - Opsiyonel başlangıç tarihi
 */
function getPast7DaysRange(endDateStr, startDateStr) {
  const endDate = endDateStr || getTodayDateTurkey();
  if (startDateStr) {
    return { startDate: startDateStr, endDate };
  }

  const d = new Date(endDate + 'T00:00:00');
  d.setDate(d.getDate() - 6);

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });

  return {
    startDate: formatter.format(d),
    endDate
  };
}

/**
 * Haftalık genel rapor verilerini toplar ve analiz eder.
 * @param {object} [options] - { startDate, endDate }
 */
async function generateWeeklyReportData(options = {}) {
  const { startDate, endDate } = getPast7DaysRange(options.endDate || options.date, options.startDate);

  // 1. Bu haftaki meal_plans (öğün) sayısını getir
  const { data: mealPlans, error: mealErr } = await supabase
    .from('meal_plans')
    .select('id, plan_date, meal_type, portion_count')
    .gte('plan_date', startDate)
    .lte('plan_date', endDate);

  if (mealErr) throw mealErr;

  const totalMeals = mealPlans ? mealPlans.length : 0;

  // 2. Son 7 günün 'out' (tüketim) stok hareketlerini getir
  let outTxs = [];
  let { data: txData, error: txErr } = await supabase
    .from('stock_transactions')
    .select(`
      id,
      product_id,
      quantity,
      transaction_date,
      transaction_type,
      products (
        id,
        name,
        unit,
        category,
        unit_price
      )
    `)
    .eq('transaction_type', 'out')
    .gte('transaction_date', startDate)
    .lte('transaction_date', endDate);

  if (txErr && (txErr.code === '42703' || txErr.message?.includes('unit_price'))) {
    const retry = await supabase
      .from('stock_transactions')
      .select(`
        id,
        product_id,
        quantity,
        transaction_date,
        transaction_type,
        products (
          id,
          name,
          unit,
          category
        )
      `)
      .eq('transaction_type', 'out')
      .gte('transaction_date', startDate)
      .lte('transaction_date', endDate);
    txData = retry.data;
    txErr = retry.error;
  }
  if (txErr) throw txErr;
  outTxs = txData || [];

  // Tüketilen ürünleri topla ve en çok tüketilen ilk 5'i bul
  const consumptionMap = {};
  (outTxs || []).forEach(tx => {
    const pid  = tx.product_id;
    const qty  = parseFloat(tx.quantity) || 0;
    const name = tx.products?.name || `Ürün #${pid}`;
    const unit = tx.products?.unit || 'adet';
    const unitPrice = (tx.products?.unit_price != null && !isNaN(parseFloat(tx.products.unit_price)) && parseFloat(tx.products.unit_price) > 0)
      ? parseFloat(tx.products.unit_price)
      : null;

    if (!consumptionMap[pid]) {
      consumptionMap[pid] = {
        product_id: pid,
        name,
        unit,
        unit_price: unitPrice,
        total_quantity: 0
      };
    }
    consumptionMap[pid].total_quantity = round4(consumptionMap[pid].total_quantity + qty);
  });

  const topConsumed = Object.values(consumptionMap)
    .sort((a, b) => b.total_quantity - a.total_quantity)
    .slice(0, 5);

  // Haftalık toplam malzeme maliyetini hesapla
  let totalWeeklyCost = 0;
  const missingPriceProducts = [];

  Object.values(consumptionMap).forEach(item => {
    if (item.unit_price != null) {
      const cost = round2(item.total_quantity * item.unit_price);
      totalWeeklyCost = round2(totalWeeklyCost + cost);
    } else {
      missingPriceProducts.push(item.name);
    }
  });

  // 3. Güncel stok ve kritik eşik durumunu getir (Azalan / Kritik ürünler)
  const { data: stockRows, error: stockErr } = await supabase
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

  const criticalOrLow = [];
  (stockRows || []).forEach(row => {
    const qty  = parseFloat(row.quantity) || 0;
    const crit = parseFloat(row.products?.critical_threshold) || 0;
    // Kritik veya eşiğe yaklaşan (kritik eşiğin 1.5 katı veya altı)
    if (crit > 0 && qty <= round4(crit * 1.5)) {
      criticalOrLow.push({
        product_id:         row.product_id,
        name:               row.products?.name || `Ürün #${row.product_id}`,
        unit:               row.products?.unit || 'adet',
        quantity:           round4(qty),
        critical_threshold: crit,
        is_critical:        qty <= crit
      });
    }
  });

  criticalOrLow.sort((a, b) => a.quantity - b.quantity);

  // 4. Tüm ürünler ve son 7 günde hareket gören ürünler (Durgun ürünleri bulmak için)
  const { data: allProducts, error: prodErr } = await supabase
    .from('products')
    .select('id, name, unit, category')
    .order('name');

  if (prodErr) throw prodErr;

  const { data: periodTxs, error: pTxErr } = await supabase
    .from('stock_transactions')
    .select('product_id')
    .gte('transaction_date', startDate)
    .lte('transaction_date', endDate);

  if (pTxErr) throw pTxErr;

  const activeProductIds = new Set((periodTxs || []).map(t => t.product_id));
  const stagnantProducts = (allProducts || []).filter(p => !activeProductIds.has(p.id));

  return {
    success:                true,
    start_date:             startDate,
    end_date:               endDate,
    total_meals:            totalMeals,
    total_cost:             totalWeeklyCost,
    missing_price_products: missingPriceProducts,
    missing_price_warning:  missingPriceProducts.length > 0
      ? `Şu ürünlerin fiyatı girilmemiş, maliyet eksik olabilir: ${missingPriceProducts.join(', ')}`
      : null,
    top_consumed:           topConsumed,
    critical_or_low:        criticalOrLow,
    stagnant_products:      stagnantProducts,
    summary: {
      total_meals:           totalMeals,
      total_cost:            totalWeeklyCost,
      top_consumed_count:    topConsumed.length,
      critical_or_low_count: criticalOrLow.length,
      stagnant_count:        stagnantProducts.length,
      total_products:        allProducts?.length || 0
    }
  };
}

/**
 * Haftalık rapor verisini okunaklı Telegram mesajına dönüştürür.
 * Format:
 * 📈 Haftalık Rapor ([başlangıç] - [bitiş])
 * Bu hafta toplam [X] öğün çıktı (Toplam maliyet: ~[Y] TL).
 * En çok tüketilen ürünler: [ürün - toplam miktar, ilk 5]
 * Azalan/kritik ürünler (hafta sonu için dikkat): [ürün - kalan]
 * Hiç hareket görmeyen (durgun) ürünler: [ürün listesi]
 * ⚠️ Şu ürünlerin fiyatı girilmemiş, maliyet eksik olabilir: [liste] (varsa)
 */
function formatWeeklyReportMessage(reportData) {
  const rangeDisplay = `${formatDateDisplay(reportData.start_date)} - ${formatDateDisplay(reportData.end_date)}`;
  const totalMeals   = reportData.total_meals ?? 0;
  const totalCost    = reportData.total_cost ?? 0;
  const formattedCost = totalCost.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // En çok tüketilen ilk 5 ürün
  let consumedLine = 'En çok tüketilen ürünler: ';
  if (reportData.top_consumed && reportData.top_consumed.length > 0) {
    consumedLine += reportData.top_consumed
      .map(i => `${i.name} - ${formatQuantity(i.total_quantity)} ${i.unit}`)
      .join(', ');
  } else {
    consumedLine += 'Bu hafta tüketim kaydı yok';
  }

  // Azalan/kritik ürünler
  let criticalLine = 'Azalan/kritik ürünler (hafta sonu için dikkat): ';
  if (reportData.critical_or_low && reportData.critical_or_low.length > 0) {
    criticalLine += reportData.critical_or_low
      .map(i => `${i.name} - ${formatQuantity(i.quantity)} ${i.unit}`)
      .join(', ');
  } else {
    criticalLine += 'Kritik ürün yok, her şey yolunda.';
  }

  // Durgun (hiç hareket görmeyen) ürünler
  let stagnantLine = 'Hiç hareket görmeyen (durgun) ürünler: ';
  if (reportData.stagnant_products && reportData.stagnant_products.length > 0) {
    stagnantLine += reportData.stagnant_products
      .map(p => p.name)
      .join(', ');
  } else {
    stagnantLine += 'Yok (Tüm ürünlerde hareket mevcut)';
  }

  const lines = [
    `📈 Haftalık Rapor (${rangeDisplay})`,
    `Bu hafta toplam ${totalMeals} öğün çıktı (Toplam maliyet: ~${formattedCost} TL).`,
    consumedLine,
    criticalLine,
    stagnantLine
  ];

  if (reportData.missing_price_products && reportData.missing_price_products.length > 0) {
    lines.push(`⚠️ Şu ürünlerin fiyatı girilmemiş, maliyet eksik olabilir: ${reportData.missing_price_products.join(', ')}`);
  }

  return lines.join('\n');
}

/**
 * Haftalık raporu hazırlayıp Telegram'a gönderir.
 * @param {object} [options] - { startDate, endDate }
 */
async function sendWeeklyReportTelegram(options = {}) {
  const reportData  = await generateWeeklyReportData(options);
  const messageText = formatWeeklyReportMessage(reportData);

  console.log('[WeeklyReport] Telegram mesajı hazırlanıyor:');
  console.log(messageText);

  const telegramResult = await sendTelegramMessage(messageText);

  return {
    success:         telegramResult.success,
    reason:          telegramResult.reason,
    error:           telegramResult.error,
    message_text:    messageText,
    data:            reportData,
    telegram_result: telegramResult
  };
}

module.exports = {
  getTodayDateTurkey,
  formatDateDisplay,
  formatQuantity,
  getPast7DaysRange,
  generateWeeklyReportData,
  formatWeeklyReportMessage,
  sendWeeklyReportTelegram
};
