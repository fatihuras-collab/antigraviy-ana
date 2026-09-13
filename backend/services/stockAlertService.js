/**
 * STOK KRİTİK SEVİYE UYARI SERVİSİ
 * 
 * - Ürün güncel stoğu kritik eşiğin altına düştüğünde Telegram'a uyarı gönderir.
 * - Mesaj formatı:
 *   "⚠️ [Ürün adı] kritik seviyede: [güncel stok] [birim] kaldı (kritik eşik [eşik] [birim])"
 * - Spam önleme: Ürün kritik seviyeye düşüp uyarı gönderildiyse, tekrar eşiğin
 *   üstüne çıkıp yeniden altına inmedikçe ikinci bir uyarı gönderilmez.
 * - Durum takibi hem yerel alert_state.json dosyasında hem de Supabase app_settings'de saklanır.
 */

const fs   = require('fs');
const path = require('path');
const supabase = require('../supabase');
const { sendTelegramMessage } = require('./telegramService');

const STATE_FILE = path.join(__dirname, '../alert_state.json');

// Bellek içi durum: Uyarı gönderilmiş ürün ID'lerinin Set'i
let alertedProductIds = new Set();
let isInitialized = false;

/**
 * Sayıyı okunabilir formatlar:
 * 5.00 -> "5", 3.50 -> "3.5", 3.75 -> "3.75"
 */
function formatQuantity(val) {
  const n = parseFloat(val);
  if (isNaN(n)) return '0';
  return Number(n.toFixed(2)).toString();
}

/**
 * Kayıtlı durumları yerel dosyadan ve Supabase app_settings tablosundan yükler.
 */
async function initAlertState() {
  if (isInitialized) return;

  // 1. Yerel dosyadan oku
  try {
    if (fs.existsSync(STATE_FILE)) {
      const raw = fs.readFileSync(STATE_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        alertedProductIds = new Set(parsed.map(Number));
      }
    }
  } catch (err) {
    console.warn('[StockAlert] Yerel durum dosyası okunamadı:', err.message);
  }

  // 2. Supabase app_settings'ten senkronize et
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'telegram_alerted_products')
        .maybeSingle();

      if (!error && data && data.value) {
        const parsed = JSON.parse(data.value);
        if (Array.isArray(parsed)) {
          alertedProductIds = new Set(parsed.map(Number));
        }
      }
    } catch (err) {
      // app_settings tablosu henüz yoksa sorunsuz geçilir
    }
  }

  isInitialized = true;
}

/**
 * Durumu hem yerel dosyaya hem de Supabase'e kaydeder.
 */
async function saveAlertState() {
  const list = Array.from(alertedProductIds);

  // 1. Yerel dosyaya yaz
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(list, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[StockAlert] Yerel durum dosyası yazılamadı:', err.message);
  }

  // 2. Supabase'e yaz
  if (supabase) {
    try {
      await supabase
        .from('app_settings')
        .upsert({
          key: 'telegram_alerted_products',
          value: JSON.stringify(list),
          description: 'Telegram stok kritik uyarısı verilmiş ürün ID listesi',
          updated_at: new Date().toISOString()
        }, { onConflict: 'key' });
    } catch (err) {
      // Tablo yoksa sessizce geç
    }
  }
}

/**
 * Verilen ürün ID'leri (veya tüm ürünler) için kritik seviye kontrolü yapar.
 * Eşiğin altına yeni inen ürünler için Telegram mesajı gönderir.
 * Eşiğin üstüne çıkan ürünlerin uyarı durumunu sıfırlar.
 * 
 * @param {number[]|number|null} productIds - Kontrol edilecek ürün ID'leri (opsiyonel)
 * @returns {Promise<{checked: number, alerted: number, reset: number}>}
 */
async function checkStockAlerts(productIds = null) {
  if (!supabase) {
    console.warn('[StockAlert] Supabase bağlantısı mevcut değil, stok kontrolü atlandı.');
    return { checked: 0, alerted: 0, reset: 0 };
  }

  await initAlertState();

  try {
    let query = supabase
      .from('products')
      .select('id, name, unit, critical_threshold, current_stock(quantity)');

    if (productIds != null) {
      const ids = Array.isArray(productIds) ? productIds : [productIds];
      const validIds = ids.map(Number).filter(id => !isNaN(id) && id > 0);
      if (validIds.length === 0) return { checked: 0, alerted: 0, reset: 0 };
      query = query.in('id', validIds);
    }

    const { data: products, error } = await query;
    if (error) throw error;
    if (!products || products.length === 0) return { checked: 0, alerted: 0, reset: 0 };

    let stateChanged = false;
    let alertedCount = 0;
    let resetCount = 0;

    for (const p of products) {
      // Güncel stok miktarını al
      let currentStock = 0;
      if (p.current_stock) {
        if (typeof p.current_stock === 'object' && !Array.isArray(p.current_stock)) {
          currentStock = p.current_stock.quantity != null ? parseFloat(p.current_stock.quantity) : 0;
        } else if (Array.isArray(p.current_stock) && p.current_stock.length > 0) {
          currentStock = p.current_stock[0]?.quantity != null ? parseFloat(p.current_stock[0].quantity) : 0;
        }
      }

      const threshold = p.critical_threshold != null ? parseFloat(p.critical_threshold) : 0;

      // Sadece kritik eşik tanımlanmış (> 0) ürünler için değerlendirilir
      if (threshold > 0) {
        const isCritical = currentStock <= threshold;

        if (isCritical) {
          // Ürün kritik seviyede: daha önce uyarılmamışsa uyarı gönder
          if (!alertedProductIds.has(p.id)) {
            const message = `⚠️ ${p.name} kritik seviyede: ${formatQuantity(currentStock)} ${p.unit} kaldı (kritik eşik ${formatQuantity(threshold)} ${p.unit})`;
            
            console.log(`[StockAlert] Kritik stok uyarısı tetiklendi: ${p.name} (Stok: ${currentStock}, Eşik: ${threshold})`);
            await sendTelegramMessage(message);

            alertedProductIds.add(p.id);
            stateChanged = true;
            alertedCount++;

            // Birden fazla ürün varsa Telegram rate-limit'e takılmamak için kısa bekleme
            await new Promise(r => setTimeout(r, 200));
          }
        } else {
          // Ürün eşiğin üstüne çıkmışsa (fatura girişi, iade vb.)
          // Uyarı durumunu sıfırla ki bir sonraki düşüşte tekrar uyarılabilsin
          if (alertedProductIds.has(p.id)) {
            console.log(`[StockAlert] Ürün eşiğin üstüne çıktı, uyarı durumu sıfırlandı: ${p.name} (Stok: ${currentStock}, Eşik: ${threshold})`);
            alertedProductIds.delete(p.id);
            stateChanged = true;
            resetCount++;
          }
        }
      }
    }

    if (stateChanged) {
      await saveAlertState();
    }

    return {
      checked: products.length,
      alerted: alertedCount,
      reset: resetCount
    };

  } catch (err) {
    console.error('[StockAlert] Stok kontrolü sırasında hata:', err.message);
    return { checked: 0, alerted: 0, reset: 0, error: err.message };
  }
}

/**
 * Uyarı geçmişini temizler (Sistemi gerçek kullanıma hazırla veya test için)
 */
async function clearAlertState() {
  alertedProductIds.clear();
  await saveAlertState();
  console.log('[StockAlert] Kritik stok uyarı geçmişi temizlendi.');
}

/**
 * Mevcut durum bilgisini döner
 */
function getAlertState() {
  return {
    alerted_count: alertedProductIds.size,
    alerted_product_ids: Array.from(alertedProductIds)
  };
}

module.exports = {
  initAlertState,
  checkStockAlerts,
  clearAlertState,
  getAlertState,
  formatQuantity
};
