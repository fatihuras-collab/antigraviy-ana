/**
 * ÜRÜN BİRİM FİYAT SERVİSİ (productPriceService.js)
 * ===================================================
 * Supabase products tablosunda unit_price kolonu bulunmadığı veya schema cache
 * senkronizasyonunda gecikme olduğu durumlarda fiyatların asla kaybolmamasını,
 * fatura/stok girişlerinde hemen kaydedilmesini ve UI/raporlarda anında
 * görünmesini sağlayan güvenli fiyat yönetim katmanı.
 */

const fs   = require('fs');
const path = require('path');

const PRICES_FILE = path.join(__dirname, '../product_prices.json');

function normalizeName(str) {
  if (!str) return '';
  return str
    .toString()
    .replace(/İ/g, 'i')
    .replace(/I/g, 'ı')
    .toLocaleLowerCase('tr-TR')
    .replace(/[^a-z0-9ğüşıöç\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseNumericPrice(val) {
  if (val == null || val === '') return null;
  if (typeof val === 'number') return isNaN(val) ? null : val;
  let str = val.toString().trim()
    .replace(/₺|TL|tl/gi, '')
    .replace(/\s+/g, '')
    .trim();

  // "1.250,50" -> "1250.50"
  if (str.includes('.') && str.includes(',')) {
    str = str.replace(/\./g, '').replace(',', '.');
  } else if (str.includes(',')) {
    // "45,50" -> "45.50"
    str = str.replace(',', '.');
  }

  const num = parseFloat(str);
  return (isNaN(num) || num < 0) ? null : num;
}

// Yerel fiyat dosyasını oku
function readPrices() {
  try {
    if (fs.existsSync(PRICES_FILE)) {
      const content = fs.readFileSync(PRICES_FILE, 'utf-8');
      return JSON.parse(content) || {};
    }
  } catch (e) {
    console.warn('[productPriceService] Fiyat dosyası okunamadı:', e.message);
  }
  return {};
}

// Yerel fiyat dosyasına yaz
function writePrices(data) {
  try {
    fs.writeFileSync(PRICES_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.warn('[productPriceService] Fiyat dosyasına yazılamadı:', e.message);
  }
}

/**
 * Belirli bir ürünün kayıtlı birim fiyatını getirir.
 * Önce ID ile, bulunamazsa normalize edilmiş isimle bakar.
 */
function getPrice(productId, productName) {
  const store = readPrices();
  if (productId && store[productId] != null) {
    return store[productId];
  }
  if (productName) {
    const norm = normalizeName(productName);
    if (store[`name_${norm}`] != null) {
      return store[`name_${norm}`];
    }
  }
  return null;
}

/**
 * Ürünün birim fiyatını hem ID hem de isim anahtarıyla kaydeder.
 */
function setPrice(productId, productName, price) {
  const parsed = parseNumericPrice(price);
  if (parsed === null) return null;

  const store = readPrices();
  if (productId) {
    store[productId] = parsed;
  }
  if (productName) {
    const norm = normalizeName(productName);
    store[`name_${norm}`] = parsed;
  }
  writePrices(store);
  return parsed;
}

/**
 * Ürün listesine (data array) eksik fiyatları yerel depodan tamamlar.
 */
function attachPricesToProducts(products) {
  if (!Array.isArray(products)) return products;
  const store = readPrices();

  return products.map(p => {
    let currentPrice = p.unit_price != null ? parseNumericPrice(p.unit_price) : null;
    if (currentPrice === null) {
      if (p.id && store[p.id] != null) {
        currentPrice = store[p.id];
      } else if (p.name) {
        const norm = normalizeName(p.name);
        if (store[`name_${norm}`] != null) {
          currentPrice = store[`name_${norm}`];
        }
      }
    }
    return {
      ...p,
      unit_price: currentPrice
    };
  });
}

module.exports = {
  getPrice,
  setPrice,
  attachPricesToProducts,
  parseNumericPrice,
  normalizeName
};
