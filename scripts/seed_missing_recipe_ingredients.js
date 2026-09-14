// scripts/seed_missing_recipe_ingredients.js
// 2-6 Yaş Anaokulu Minimal Porsiyon Reçete Tanımlayıcı

const supabase = require('../backend/supabase');

/**
 * Ürün ID Referansları:
 * 1: Pirinç (kg)
 * 2: Bulgur (ince) (kg)
 * 3: Kırmızı Mercimek (kg)
 * 4: Nohut (kg)
 * 5: Kıyma (dana) (kg)
 * 6: Tavuk But (kg)
 * 7: Tavuk Göğüs (kg)
 * 8: Patates (kg)
 * 9: Soğan (kg)
 * 10: Domates (kg)
 * 11: Biber (kapya) (kg)
 * 12: Ispanak (kg)
 * 13: Havuç (kg)
 * 14: Fasulye (taze) (kg)
 * 15: Süt (litre)
 * 16: Tereyağı (kg)
 * 17: Sıvı Yağ (ayçiçek) (litre)
 * 18: Domates Salçası (kg)
 * 19: Tuz (kg)
 * 20: Un (kg)
 * 21: Yumurta (adet)
 * 22: Beyaz Peynir (kg)
 * 23: Siyah Zeytin (kg)
 * 24: Yulaf Ezmesi (kg)
 * 25: Elma (kg)
 * 26: Salatalık (kg)
 * 27: Tam Buğday Ekmeği (adet)
 * 28: Yoğurt (kg)
 * 29: Kabak (kg)
 * 30: Muz (kg)
 * 31: Armut (kg)
 * 32: Kuru Fasulye (Kuru) (kg)
 * 33: Kılçıksız Balık Fileto (kg)
 * 34: Makarna / Erişte (kg)
 * 35: Lor Peyniri (kg)
 * 36: Kaşar Peyniri (kg)
 * 37: Kuşbaşı Et (dana) (kg)
 * 38: Bezelye (kg)
 * 39: Yeşil Mercimek (kg)
 * 40: Tarhana (kg)
 * 41: Böreklik Yufka (kg)
 * 42: Şeker (kg)
 * 43: Marul / Salata Yeşilliği (kg)
 * 44: Portakal (kg)
 * 45: Üzüm (kg)
 */

const recipeDefinitions = [
  // ──────────────────────────────────────────────────────────
  // 6: Patates Haşlama (ogle)
  // ──────────────────────────────────────────────────────────
  {
    id: 6,
    missing: [],
    ingredients: [
      { product_id: 8, quantity: 0.08 },   // Patates
      { product_id: 17, quantity: 0.003 }, // Sıvı Yağ
      { product_id: 19, quantity: 0.0005 } // Tuz
    ]
  },

  // ──────────────────────────────────────────────────────────
  // 7: Bulgur Pilavı (ogle)
  // ──────────────────────────────────────────────────────────
  {
    id: 7,
    missing: [],
    ingredients: [
      { product_id: 2, quantity: 0.03 },   // Bulgur (ince)
      { product_id: 18, quantity: 0.005 }, // Domates Salçası
      { product_id: 17, quantity: 0.004 }, // Sıvı Yağ
      { product_id: 19, quantity: 0.0005 } // Tuz
    ]
  },

  // ──────────────────────────────────────────────────────────
  // 68: Bitki Çayı, Haşlanmış Yumurta, Çeçil Peyniri, Zeytin, Ev Yapımı Reçelli Pilavı Ekmek (kahvalti)
  // Not: Çeçil peyniri -> Kaşar Peyniri (36), Ekmek -> Tam Buğday Ekmeği (27)
  // ──────────────────────────────────────────────────────────
  {
    id: 68,
    missing: ['Bitki Çayı', 'Reçel'],
    ingredients: [
      { product_id: 21, quantity: 0.5 },   // Yumurta (yarım adet)
      { product_id: 36, quantity: 0.02 },  // Kaşar/Çeçil Peyniri
      { product_id: 23, quantity: 0.01 },  // Siyah Zeytin
      { product_id: 27, quantity: 0.05 }   // Tam Buğday Ekmeği (1 dilim)
    ]
  },

  // ──────────────────────────────────────────────────────────
  // 69: Domates Çorbası, Fırında Köfte, Patates, Pirinç Pilavı, Ayran (ogle)
  // ──────────────────────────────────────────────────────────
  {
    id: 69,
    missing: [],
    ingredients: [
      { product_id: 10, quantity: 0.035 }, // Domates (çorba)
      { product_id: 20, quantity: 0.006 }, // Un (çorba meyanesi)
      { product_id: 5,  quantity: 0.035 }, // Kıyma (dana köfte)
      { product_id: 9,  quantity: 0.006 }, // Soğan (köfte)
      { product_id: 8,  quantity: 0.04 },  // Patates (fırın patates)
      { product_id: 1,  quantity: 0.025 }, // Pirinç (pilav)
      { product_id: 28, quantity: 0.05 },  // Yoğurt (ayran)
      { product_id: 17, quantity: 0.006 }, // Sıvı Yağ (çorba + köfte + pilav)
      { product_id: 19, quantity: 0.001 }  // Tuz
    ]
  },

  // ──────────────────────────────────────────────────────────
  // 70: Kek, Süt (ikindi)
  // ──────────────────────────────────────────────────────────
  {
    id: 70,
    missing: [],
    ingredients: [
      { product_id: 15, quantity: 0.15 },  // Süt (1 bardak içecek)
      { product_id: 20, quantity: 0.025 }, // Un (kek)
      { product_id: 21, quantity: 0.15 },  // Yumurta (kek)
      { product_id: 42, quantity: 0.008 }, // Şeker (kek)
      { product_id: 17, quantity: 0.005 }  // Sıvı Yağ (kek)
    ]
  },

  // ──────────────────────────────────────────────────────────
  // 71: Meyve Suyu, Tost, Salatalık Dilimleri (kahvalti)
  // ──────────────────────────────────────────────────────────
  {
    id: 71,
    missing: ['Meyve Suyu'],
    ingredients: [
      { product_id: 27, quantity: 0.06 },  // Tam Buğday Ekmeği (tost ekmeği)
      { product_id: 36, quantity: 0.02 },  // Kaşar Peyniri (tost içi)
      { product_id: 16, quantity: 0.003 }, // Tereyağı (tost)
      { product_id: 26, quantity: 0.03 }   // Salatalık (dilim)
    ]
  },

  // ──────────────────────────────────────────────────────────
  // 72: Nohut, Bulgur Pilavı, Turşu (ogle)
  // ──────────────────────────────────────────────────────────
  {
    id: 72,
    missing: ['Turşu'],
    ingredients: [
      { product_id: 4,  quantity: 0.035 }, // Nohut
      { product_id: 9,  quantity: 0.008 }, // Soğan
      { product_id: 18, quantity: 0.006 }, // Domates Salçası
      { product_id: 2,  quantity: 0.03 },  // Bulgur (ince)
      { product_id: 17, quantity: 0.006 }, // Sıvı Yağ
      { product_id: 19, quantity: 0.001 }  // Tuz
    ]
  },

  // ──────────────────────────────────────────────────────────
  // 73: Tuzlu Kurabiye, Limonata (ikindi)
  // ──────────────────────────────────────────────────────────
  {
    id: 73,
    missing: ['Limonata'],
    ingredients: [
      { product_id: 20, quantity: 0.03 },  // Un
      { product_id: 16, quantity: 0.006 }, // Tereyağı
      { product_id: 17, quantity: 0.004 }, // Sıvı Yağ
      { product_id: 21, quantity: 0.1 },   // Yumurta
      { product_id: 19, quantity: 0.0005 } // Tuz
    ]
  },

  // ──────────────────────────────────────────────────────────
  // 74: Süt, Peynirli Omlet, Siyah Zeytin, Ev Yapımı Reçelli Ekmek (kahvalti)
  // ──────────────────────────────────────────────────────────
  {
    id: 74,
    missing: ['Reçel'],
    ingredients: [
      { product_id: 15, quantity: 0.15 },  // Süt (1 bardak)
      { product_id: 21, quantity: 0.5 },   // Yumurta (omlet - yarım adet)
      { product_id: 22, quantity: 0.02 },  // Beyaz Peynir (omlet içi)
      { product_id: 16, quantity: 0.003 }, // Tereyağı (omlet)
      { product_id: 23, quantity: 0.01 },  // Siyah Zeytin
      { product_id: 27, quantity: 0.05 }   // Tam Buğday Ekmeği
    ]
  },

  // ──────────────────────────────────────────────────────────
  // 75: Mercimek Çorbası, Tavuk Sote, Makarna, Salata (ogle)
  // ──────────────────────────────────────────────────────────
  {
    id: 75,
    missing: [],
    ingredients: [
      { product_id: 3,  quantity: 0.015 }, // Kırmızı Mercimek
      { product_id: 7,  quantity: 0.035 }, // Tavuk Göğüs
      { product_id: 10, quantity: 0.02 },  // Domates (sote)
      { product_id: 11, quantity: 0.01 },  // Biber (kapya)
      { product_id: 9,  quantity: 0.006 }, // Soğan
      { product_id: 34, quantity: 0.03 },  // Makarna / Erişte
      { product_id: 43, quantity: 0.025 }, // Marul / Salata Yeşilliği
      { product_id: 26, quantity: 0.015 }, // Salatalık
      { product_id: 17, quantity: 0.006 }, // Sıvı Yağ
      { product_id: 19, quantity: 0.001 }  // Tuz
    ]
  },

  // ──────────────────────────────────────────────────────────
  // 76: Mini Zeytinli Poğaça, Havuç Dilimleri (ikindi)
  // ──────────────────────────────────────────────────────────
  {
    id: 76,
    missing: [],
    ingredients: [
      { product_id: 20, quantity: 0.03 },  // Un
      { product_id: 23, quantity: 0.01 },  // Siyah Zeytin
      { product_id: 28, quantity: 0.02 },  // Yoğurt (hamur)
      { product_id: 17, quantity: 0.005 }, // Sıvı Yağ
      { product_id: 21, quantity: 0.1 },   // Yumurta
      { product_id: 13, quantity: 0.03 }   // Havuç Dilimleri
    ]
  },

  // ──────────────────────────────────────────────────────────
  // 77: Bitki Çayı, Gözleme, Domates, Salatalık (kahvalti)
  // ──────────────────────────────────────────────────────────
  {
    id: 77,
    missing: ['Bitki Çayı'],
    ingredients: [
      { product_id: 41, quantity: 0.035 }, // Böreklik Yufka (gözleme)
      { product_id: 22, quantity: 0.02 },  // Beyaz Peynir
      { product_id: 16, quantity: 0.003 }, // Tereyağı
      { product_id: 10, quantity: 0.025 }, // Domates
      { product_id: 26, quantity: 0.025 }  // Salatalık
    ]
  },

  // ──────────────────────────────────────────────────────────
  // 78: Tarhana Çorbası, Taze Fasulye, Arpa Şehriye Pilavı, Yoğurt (ogle)
  // ──────────────────────────────────────────────────────────
  {
    id: 78,
    missing: [],
    ingredients: [
      { product_id: 40, quantity: 0.015 }, // Tarhana
      { product_id: 14, quantity: 0.05 },  // Fasulye (taze)
      { product_id: 10, quantity: 0.02 },  // Domates
      { product_id: 9,  quantity: 0.006 }, // Soğan
      { product_id: 34, quantity: 0.03 },  // Makarna / Erişte (şehriye)
      { product_id: 28, quantity: 0.05 },  // Yoğurt
      { product_id: 17, quantity: 0.006 }, // Sıvı Yağ
      { product_id: 19, quantity: 0.001 }  // Tuz
    ]
  },

  // ──────────────────────────────────────────────────────────
  // 79: Muhallebi (ikindi)
  // ──────────────────────────────────────────────────────────
  {
    id: 79,
    missing: [],
    ingredients: [
      { product_id: 15, quantity: 0.15 },  // Süt
      { product_id: 20, quantity: 0.015 }, // Un
      { product_id: 42, quantity: 0.01 },  // Şeker
      { product_id: 16, quantity: 0.003 }  // Tereyağı
    ]
  },

  // ──────────────────────────────────────────────────────────
  // 80: Süt, Pankek, Bal, Ceviz (kahvalti)
  // ──────────────────────────────────────────────────────────
  {
    id: 80,
    missing: ['Bal', 'Ceviz'],
    ingredients: [
      { product_id: 15, quantity: 0.17 },  // Süt (0.15 içecek + 0.02 pankek)
      { product_id: 20, quantity: 0.025 }, // Un
      { product_id: 21, quantity: 0.25 },  // Yumurta (pankek)
      { product_id: 42, quantity: 0.004 }, // Şeker
      { product_id: 17, quantity: 0.003 }  // Sıvı Yağ
    ]
  },

  // ──────────────────────────────────────────────────────────
  // 81: Bezelye, Pirinç Pilavı, Salata (ogle)
  // ──────────────────────────────────────────────────────────
  {
    id: 81,
    missing: [],
    ingredients: [
      { product_id: 38, quantity: 0.045 }, // Bezelye
      { product_id: 13, quantity: 0.015 }, // Havuç
      { product_id: 8,  quantity: 0.02 },  // Patates
      { product_id: 9,  quantity: 0.006 }, // Soğan
      { product_id: 18, quantity: 0.005 }, // Domates Salçası
      { product_id: 1,  quantity: 0.03 },  // Pirinç (pilav)
      { product_id: 43, quantity: 0.025 }, // Marul / Salata Yeşilliği
      { product_id: 10, quantity: 0.015 }, // Domates
      { product_id: 17, quantity: 0.006 }, // Sıvı Yağ
      { product_id: 19, quantity: 0.001 }  // Tuz
    ]
  },

  // ──────────────────────────────────────────────────────────
  // 82: Karpuz, Tuzlu Çubuk (ikindi)
  // ──────────────────────────────────────────────────────────
  {
    id: 82,
    missing: ['Karpuz', 'Tuzlu Çubuk Kraker'],
    ingredients: [
      { product_id: 20, quantity: 0.025 }, // Un (çubuk kraker tabanı)
      { product_id: 17, quantity: 0.004 }, // Sıvı Yağ
      { product_id: 19, quantity: 0.0005 } // Tuz
    ]
  },

  // ──────────────────────────────────────────────────────────
  // 83: Bitki Çayı, Haşlanmış Yumurta, Beyaz Peynir, Salatalık, Zeytin (kahvalti)
  // ──────────────────────────────────────────────────────────
  {
    id: 83,
    missing: ['Bitki Çayı'],
    ingredients: [
      { product_id: 21, quantity: 0.5 },   // Yumurta (0.5 adet)
      { product_id: 22, quantity: 0.02 },  // Beyaz Peynir (20 g)
      { product_id: 26, quantity: 0.03 },  // Salatalık (30 g)
      { product_id: 23, quantity: 0.01 },  // Siyah Zeytin (10 g)
      { product_id: 27, quantity: 0.05 }   // Tam Buğday Ekmeği (1 dilim)
    ]
  },

  // ──────────────────────────────────────────────────────────
  // 84: Şehriye Çorbası, Orman Kebabı, Bulgur Pilavı, Yoğurt (ogle)
  // ──────────────────────────────────────────────────────────
  {
    id: 84,
    missing: [],
    ingredients: [
      { product_id: 34, quantity: 0.012 }, // Şehriye (çorba)
      { product_id: 18, quantity: 0.005 }, // Domates Salçası (çorba)
      { product_id: 37, quantity: 0.035 }, // Kuşbaşı Et (dana) (35 g)
      { product_id: 38, quantity: 0.015 }, // Bezelye (orman kebabı)
      { product_id: 13, quantity: 0.015 }, // Havuç (orman kebabı)
      { product_id: 8,  quantity: 0.02 },  // Patates (orman kebabı)
      { product_id: 9,  quantity: 0.006 }, // Soğan
      { product_id: 2,  quantity: 0.03 },  // Bulgur (ince) (pilav)
      { product_id: 28, quantity: 0.05 },  // Yoğurt (50 g)
      { product_id: 17, quantity: 0.006 }, // Sıvı Yağ
      { product_id: 19, quantity: 0.001 }  // Tuz
    ]
  },

  // ──────────────────────────────────────────────────────────
  // 85: Mozaik Pasta, Süt (ikindi)
  // ──────────────────────────────────────────────────────────
  {
    id: 85,
    missing: ['Petibör Bisküvi', 'Kakao'],
    ingredients: [
      { product_id: 15, quantity: 0.17 },  // Süt (0.15 bardak süt + 0.02 pasta harcı)
      { product_id: 20, quantity: 0.025 }, // Un / Bisküvi eşleniği
      { product_id: 42, quantity: 0.008 }, // Şeker
      { product_id: 16, quantity: 0.005 }  // Tereyağı
    ]
  },

  // ──────────────────────────────────────────────────────────
  // 86: Limonata, Kalem Börek, Domates, Salatalık (kahvalti)
  // ──────────────────────────────────────────────────────────
  {
    id: 86,
    missing: ['Limonata'],
    ingredients: [
      { product_id: 41, quantity: 0.03 },  // Böreklik Yufka
      { product_id: 35, quantity: 0.02 },  // Lor Peyniri (börek içi)
      { product_id: 17, quantity: 0.005 }, // Sıvı Yağ
      { product_id: 10, quantity: 0.025 }, // Domates
      { product_id: 26, quantity: 0.025 }  // Salatalık
    ]
  },

  // ──────────────────────────────────────────────────────────
  // 87: Kuru Fasulye, Pirinç Pilavı, Cacık (ogle)
  // ──────────────────────────────────────────────────────────
  {
    id: 87,
    missing: [],
    ingredients: [
      { product_id: 32, quantity: 0.035 }, // Kuru Fasulye (Kuru)
      { product_id: 9,  quantity: 0.008 }, // Soğan
      { product_id: 18, quantity: 0.006 }, // Domates Salçası
      { product_id: 1,  quantity: 0.03 },  // Pirinç
      { product_id: 28, quantity: 0.05 },  // Yoğurt (cacık)
      { product_id: 26, quantity: 0.02 },  // Salatalık (cacık)
      { product_id: 17, quantity: 0.006 }, // Sıvı Yağ
      { product_id: 19, quantity: 0.001 }  // Tuz
    ]
  },

  // ──────────────────────────────────────────────────────────
  // 88: Doğum Günü Pastası (ikindi)
  // ──────────────────────────────────────────────────────────
  {
    id: 88,
    missing: ['Pasta Süsü / Kreması'],
    ingredients: [
      { product_id: 20, quantity: 0.03 },  // Un (pandispanya)
      { product_id: 21, quantity: 0.2 },   // Yumurta
      { product_id: 15, quantity: 0.05 },  // Süt (krema)
      { product_id: 42, quantity: 0.012 }, // Şeker
      { product_id: 16, quantity: 0.005 }  // Tereyağı
    ]
  },

  // ──────────────────────────────────────────────────────────
  // 89: Süt, Omlet, Tahin Pekmezli Ekmek (kahvalti)
  // ──────────────────────────────────────────────────────────
  {
    id: 89,
    missing: ['Tahin', 'Pekmez'],
    ingredients: [
      { product_id: 15, quantity: 0.15 },  // Süt (1 bardak)
      { product_id: 21, quantity: 0.5 },   // Yumurta (omlet - 0.5 adet)
      { product_id: 16, quantity: 0.003 }, // Tereyağı (omlet)
      { product_id: 27, quantity: 0.05 }   // Tam Buğday Ekmeği (1 dilim)
    ]
  },

  // ──────────────────────────────────────────────────────────
  // 90: Tavuk Şiş, Spagetti, Salata (ogle)
  // ──────────────────────────────────────────────────────────
  {
    id: 90,
    missing: [],
    ingredients: [
      { product_id: 7,  quantity: 0.04 },  // Tavuk Göğüs (şiş)
      { product_id: 34, quantity: 0.03 },  // Makarna / Erişte (spagetti)
      { product_id: 18, quantity: 0.004 }, // Domates Salçası (sos)
      { product_id: 43, quantity: 0.025 }, // Marul / Salata Yeşilliği
      { product_id: 10, quantity: 0.015 }, // Domates
      { product_id: 26, quantity: 0.015 }, // Salatalık
      { product_id: 17, quantity: 0.006 }, // Sıvı Yağ
      { product_id: 19, quantity: 0.001 }  // Tuz
    ]
  },

  // ──────────────────────────────────────────────────────────
  // 91: Mahlepli Kurabiye, Meyve Suyu (ikindi)
  // ──────────────────────────────────────────────────────────
  {
    id: 91,
    missing: ['Mahlep', 'Meyve Suyu'],
    ingredients: [
      { product_id: 20, quantity: 0.03 },  // Un
      { product_id: 16, quantity: 0.008 }, // Tereyağı
      { product_id: 17, quantity: 0.004 }, // Sıvı Yağ
      { product_id: 21, quantity: 0.1 },   // Yumurta
      { product_id: 42, quantity: 0.006 }  // Şeker
    ]
  },

  // ──────────────────────────────────────────────────────────
  // 92: Meyve Suyu, Patatesli Omlet, Çeçil Peyniri, Ev Yapımı Reçelli Ekmek (kahvalti)
  // ──────────────────────────────────────────────────────────
  {
    id: 92,
    missing: ['Meyve Suyu', 'Reçel'],
    ingredients: [
      { product_id: 21, quantity: 0.5 },   // Yumurta (0.5 adet)
      { product_id: 8,  quantity: 0.03 },  // Patates (omlet içi)
      { product_id: 36, quantity: 0.02 },  // Kaşar/Çeçil Peyniri
      { product_id: 27, quantity: 0.05 },  // Tam Buğday Ekmeği
      { product_id: 17, quantity: 0.003 }  // Sıvı Yağ
    ]
  },

  // ──────────────────────────────────────────────────────────
  // 93: Domates Çorbası, Biber Dolma, Yoğurt (ogle)
  // ──────────────────────────────────────────────────────────
  {
    id: 93,
    missing: [],
    ingredients: [
      { product_id: 10, quantity: 0.035 }, // Domates (çorba)
      { product_id: 20, quantity: 0.006 }, // Un (çorba)
      { product_id: 11, quantity: 0.045 }, // Biber (kapya/dolmalık)
      { product_id: 5,  quantity: 0.03 },  // Kıyma (dana dolma harcı)
      { product_id: 1,  quantity: 0.015 }, // Pirinç (dolma içi)
      { product_id: 9,  quantity: 0.006 }, // Soğan
      { product_id: 18, quantity: 0.005 }, // Domates Salçası
      { product_id: 28, quantity: 0.05 },  // Yoğurt
      { product_id: 17, quantity: 0.006 }, // Sıvı Yağ
      { product_id: 19, quantity: 0.001 }  // Tuz
    ]
  },

  // ──────────────────────────────────────────────────────────
  // 94: Dondurma (ikindi)
  // ──────────────────────────────────────────────────────────
  {
    id: 94,
    missing: ['Dondurma / Salep'],
    ingredients: [
      { product_id: 15, quantity: 0.1 },   // Süt
      { product_id: 42, quantity: 0.015 }  // Şeker
    ]
  },

  // ──────────────────────────────────────────────────────────
  // 95: Süt, Krep, Labne, Bal, Badem (kahvalti)
  // ──────────────────────────────────────────────────────────
  {
    id: 95,
    missing: ['Labne', 'Bal', 'Badem'],
    ingredients: [
      { product_id: 15, quantity: 0.18 },  // Süt (0.15 bardak süt + 0.03 krep)
      { product_id: 20, quantity: 0.025 }, // Un (krep)
      { product_id: 21, quantity: 0.25 },  // Yumurta (krep)
      { product_id: 35, quantity: 0.015 }, // Lor Peyniri (Labne muadili)
      { product_id: 17, quantity: 0.003 }  // Sıvı Yağ
    ]
  },

  // ──────────────────────────────────────────────────────────
  // 96: İzmir Köfte, Kuskus, Salata (ogle)
  // ──────────────────────────────────────────────────────────
  {
    id: 96,
    missing: [],
    ingredients: [
      { product_id: 5,  quantity: 0.035 }, // Kıyma (dana köfte)
      { product_id: 8,  quantity: 0.035 }, // Patates
      { product_id: 10, quantity: 0.02 },  // Domates
      { product_id: 11, quantity: 0.01 },  // Biber (kapya)
      { product_id: 9,  quantity: 0.006 }, // Soğan
      { product_id: 18, quantity: 0.005 }, // Domates Salçası
      { product_id: 34, quantity: 0.03 },  // Makarna / Erişte (kuskus)
      { product_id: 43, quantity: 0.025 }, // Marul / Salata Yeşilliği
      { product_id: 13, quantity: 0.015 }, // Havuç
      { product_id: 17, quantity: 0.006 }, // Sıvı Yağ
      { product_id: 19, quantity: 0.001 }  // Tuz
    ]
  },

  // ──────────────────────────────────────────────────────────
  // 97: Milföy Börek, Ayran (ikindi)
  // ──────────────────────────────────────────────────────────
  {
    id: 97,
    missing: [],
    ingredients: [
      { product_id: 41, quantity: 0.035 }, // Böreklik Yufka (milföy eşleniği)
      { product_id: 22, quantity: 0.015 }, // Beyaz Peynir
      { product_id: 16, quantity: 0.005 }, // Tereyağı
      { product_id: 21, quantity: 0.1 },   // Yumurta (üzeri için)
      { product_id: 28, quantity: 0.05 }   // Yoğurt (ayran)
    ]
  },

  // ──────────────────────────────────────────────────────────
  // 98: Bitki Çayı, Haşlanmış Yumurta, Labneli Ekmek, Zeytin (kahvalti)
  // ──────────────────────────────────────────────────────────
  {
    id: 98,
    missing: ['Bitki Çayı', 'Labne'],
    ingredients: [
      { product_id: 21, quantity: 0.5 },   // Yumurta (0.5 adet)
      { product_id: 27, quantity: 0.05 },  // Tam Buğday Ekmeği (1 dilim)
      { product_id: 35, quantity: 0.02 },  // Lor Peyniri (Labne muadili)
      { product_id: 23, quantity: 0.01 }   // Siyah Zeytin
    ]
  },

  // ──────────────────────────────────────────────────────────
  // 99: Kıymalı Mercimek Yemeği, Erişte, Erişte (ogle)
  // ──────────────────────────────────────────────────────────
  {
    id: 99,
    missing: [],
    ingredients: [
      { product_id: 39, quantity: 0.03 },  // Yeşil Mercimek
      { product_id: 5,  quantity: 0.03 },  // Kıyma (dana)
      { product_id: 9,  quantity: 0.006 }, // Soğan
      { product_id: 18, quantity: 0.005 }, // Domates Salçası
      { product_id: 34, quantity: 0.03 },  // Makarna / Erişte
      { product_id: 28, quantity: 0.04 },  // Yoğurt (eşlikçi)
      { product_id: 17, quantity: 0.006 }, // Sıvı Yağ
      { product_id: 19, quantity: 0.001 }  // Tuz
    ]
  },

  // ──────────────────────────────────────────────────────────
  // 100: Zebra Kek, Süt (ikindi)
  // ──────────────────────────────────────────────────────────
  {
    id: 100,
    missing: ['Kakao'],
    ingredients: [
      { product_id: 15, quantity: 0.15 },  // Süt (1 bardak)
      { product_id: 20, quantity: 0.025 }, // Un
      { product_id: 21, quantity: 0.15 },  // Yumurta
      { product_id: 42, quantity: 0.008 }, // Şeker
      { product_id: 17, quantity: 0.005 }  // Sıvı Yağ
    ]
  },

  // ──────────────────────────────────────────────────────────
  // 101: Meyve Suyu, Menemen, Salatalık, Çeçil Peyniri, Ekmek (kahvalti)
  // ──────────────────────────────────────────────────────────
  {
    id: 101,
    missing: ['Meyve Suyu'],
    ingredients: [
      { product_id: 21, quantity: 0.5 },   // Yumurta (0.5 adet)
      { product_id: 10, quantity: 0.035 }, // Domates (menemen)
      { product_id: 11, quantity: 0.015 }, // Biber (kapya)
      { product_id: 36, quantity: 0.02 },  // Kaşar/Çeçil Peyniri
      { product_id: 26, quantity: 0.025 }, // Salatalık
      { product_id: 27, quantity: 0.05 },  // Tam Buğday Ekmeği
      { product_id: 17, quantity: 0.003 }  // Sıvı Yağ
    ]
  },

  // ──────────────────────────────────────────────────────────
  // 102: Tavuk Suyu Çorba, Tavuklu Pilav, Ayran (ogle)
  // ──────────────────────────────────────────────────────────
  {
    id: 102,
    missing: [],
    ingredients: [
      { product_id: 7,  quantity: 0.035 }, // Tavuk Göğüs (çorba + pilav üstü)
      { product_id: 20, quantity: 0.006 }, // Un (çorba terbiye)
      { product_id: 13, quantity: 0.008 }, // Havuç (çorba)
      { product_id: 1,  quantity: 0.025 }, // Pirinç (pilav)
      { product_id: 28, quantity: 0.05 },  // Yoğurt (ayran)
      { product_id: 17, quantity: 0.006 }, // Sıvı Yağ
      { product_id: 19, quantity: 0.001 }  // Tuz
    ]
  },

  // ──────────────────────────────────────────────────────────
  // 103: Patlıcanlı Börek (ikindi)
  // ──────────────────────────────────────────────────────────
  {
    id: 103,
    missing: ['Patlıcan'],
    ingredients: [
      { product_id: 41, quantity: 0.035 }, // Böreklik Yufka
      { product_id: 9,  quantity: 0.01 },  // Soğan (harç)
      { product_id: 10, quantity: 0.015 }, // Domates (harç)
      { product_id: 21, quantity: 0.1 },   // Yumurta (üzeri için)
      { product_id: 17, quantity: 0.005 }, // Sıvı Yağ
      { product_id: 19, quantity: 0.0005 } // Tuz
    ]
  },

  // ──────────────────────────────────────────────────────────
  // 104: Süt, Omlet, Ev Yapımı Reçelli Ekmek (kahvalti)
  // ──────────────────────────────────────────────────────────
  {
    id: 104,
    missing: ['Reçel'],
    ingredients: [
      { product_id: 15, quantity: 0.15 },  // Süt (1 bardak)
      { product_id: 21, quantity: 0.5 },   // Yumurta (0.5 adet)
      { product_id: 16, quantity: 0.003 }, // Tereyağı
      { product_id: 27, quantity: 0.05 }   // Tam Buğday Ekmeği (1 dilim)
    ]
  },

  // ──────────────────────────────────────────────────────────
  // 105: Mantı, Yoğurt (ogle)
  // ──────────────────────────────────────────────────────────
  {
    id: 105,
    missing: [],
    ingredients: [
      { product_id: 20, quantity: 0.035 }, // Un (mantı hamuru)
      { product_id: 5,  quantity: 0.025 }, // Kıyma (dana kıyma harcı)
      { product_id: 9,  quantity: 0.005 }, // Soğan
      { product_id: 21, quantity: 0.1 },   // Yumurta
      { product_id: 28, quantity: 0.06 },  // Yoğurt (sos)
      { product_id: 16, quantity: 0.004 }, // Tereyağı (sos)
      { product_id: 18, quantity: 0.004 }, // Domates Salçası (sos)
      { product_id: 19, quantity: 0.001 }  // Tuz
    ]
  },

  // ──────────────────────────────────────────────────────────
  // 106: Revani (ikindi)
  // ──────────────────────────────────────────────────────────
  {
    id: 106,
    missing: ['İrmik'],
    ingredients: [
      { product_id: 20, quantity: 0.025 }, // Un (İrmik muadili/tabanı)
      { product_id: 21, quantity: 0.15 },  // Yumurta
      { product_id: 42, quantity: 0.012 }, // Şeker (şerbet + hamur)
      { product_id: 28, quantity: 0.02 },  // Yoğurt
      { product_id: 17, quantity: 0.004 }  // Sıvı Yağ
    ]
  },

  // ──────────────────────────────────────────────────────────
  // 107: Limonata, Pişi, Beyaz Peynir, Zeytin, Domates, Salatalık (kahvalti)
  // ──────────────────────────────────────────────────────────
  {
    id: 107,
    missing: ['Limonata'],
    ingredients: [
      { product_id: 20, quantity: 0.035 }, // Un (pişi hamuru)
      { product_id: 28, quantity: 0.015 }, // Yoğurt (pişi)
      { product_id: 17, quantity: 0.006 }, // Sıvı Yağ (kızartma/pişi)
      { product_id: 22, quantity: 0.02 },  // Beyaz Peynir
      { product_id: 23, quantity: 0.01 },  // Siyah Zeytin
      { product_id: 10, quantity: 0.025 }, // Domates
      { product_id: 26, quantity: 0.025 }  // Salatalık
    ]
  },

  // ──────────────────────────────────────────────────────────
  // 108: Ezogelin Çorbası, Kabak Yemeği, Makarna, Salata (ogle)
  // ──────────────────────────────────────────────────────────
  {
    id: 108,
    missing: [],
    ingredients: [
      { product_id: 3,  quantity: 0.015 }, // Kırmızı Mercimek
      { product_id: 2,  quantity: 0.005 }, // Bulgur (ince) (çorba)
      { product_id: 1,  quantity: 0.004 }, // Pirinç (çorba)
      { product_id: 29, quantity: 0.05 },  // Kabak (yemek)
      { product_id: 5,  quantity: 0.025 }, // Kıyma (dana kıymalı kabak)
      { product_id: 9,  quantity: 0.006 }, // Soğan
      { product_id: 10, quantity: 0.015 }, // Domates
      { product_id: 18, quantity: 0.004 }, // Domates Salçası
      { product_id: 34, quantity: 0.03 },  // Makarna / Erişte
      { product_id: 43, quantity: 0.025 }, // Marul / Salata Yeşilliği
      { product_id: 17, quantity: 0.006 }, // Sıvı Yağ
      { product_id: 19, quantity: 0.001 }  // Tuz
    ]
  },

  // ──────────────────────────────────────────────────────────
  // 109: Pizza, Ayran (ikindi)
  // ──────────────────────────────────────────────────────────
  {
    id: 109,
    missing: [],
    ingredients: [
      { product_id: 20, quantity: 0.035 }, // Un (pizza hamuru)
      { product_id: 36, quantity: 0.02 },  // Kaşar Peyniri (pizza üstü)
      { product_id: 18, quantity: 0.005 }, // Domates Salçası (pizza sosu)
      { product_id: 11, quantity: 0.01 },  // Biber (kapya)
      { product_id: 23, quantity: 0.005 }, // Siyah Zeytin
      { product_id: 28, quantity: 0.05 },  // Yoğurt (ayran)
      { product_id: 17, quantity: 0.004 }  // Sıvı Yağ
    ]
  },

  // ──────────────────────────────────────────────────────────
  // 110: Fırında Misket Köfte, Patates Püresi, Salatalık, Domates (ogle)
  // ──────────────────────────────────────────────────────────
  {
    id: 110,
    missing: [],
    ingredients: [
      { product_id: 5,  quantity: 0.035 }, // Kıyma (dana köfte)
      { product_id: 9,  quantity: 0.006 }, // Soğan
      { product_id: 8,  quantity: 0.05 },  // Patates (püre)
      { product_id: 15, quantity: 0.02 },  // Süt (püre)
      { product_id: 16, quantity: 0.003 }, // Tereyağı (püre)
      { product_id: 26, quantity: 0.025 }, // Salatalık
      { product_id: 10, quantity: 0.025 }, // Domates
      { product_id: 17, quantity: 0.004 }, // Sıvı Yağ
      { product_id: 19, quantity: 0.001 }  // Tuz
    ]
  },

  // ──────────────────────────────────────────────────────────
  // 111: Üzümlü Kurabiye, Meyve Suyu (ikindi)
  // ──────────────────────────────────────────────────────────
  {
    id: 111,
    missing: ['Meyve Suyu'],
    ingredients: [
      { product_id: 20, quantity: 0.03 },  // Un
      { product_id: 45, quantity: 0.015 }, // Üzüm (kuru üzüm yerine üzüm)
      { product_id: 16, quantity: 0.006 }, // Tereyağı
      { product_id: 17, quantity: 0.004 }, // Sıvı Yağ
      { product_id: 21, quantity: 0.1 },   // Yumurta
      { product_id: 42, quantity: 0.006 }  // Şeker
    ]
  },

  // ──────────────────────────────────────────────────────────
  // 112: Bitki Çayı, Haşlanmış Yumurta, Çeçil Peyniri, Tereyağlı Ballı Ekmek (kahvalti)
  // ──────────────────────────────────────────────────────────
  {
    id: 112,
    missing: ['Bitki Çayı', 'Bal'],
    ingredients: [
      { product_id: 21, quantity: 0.5 },   // Yumurta (0.5 adet)
      { product_id: 36, quantity: 0.02 },  // Kaşar/Çeçil Peyniri
      { product_id: 27, quantity: 0.05 },  // Tam Buğday Ekmeği (1 dilim)
      { product_id: 16, quantity: 0.004 }  // Tereyağı (ekmek üstü)
    ]
  },

  // ──────────────────────────────────────────────────────────
  // 113: Patates Oturtma, Bulgur Pilavı, Salata (ogle)
  // ──────────────────────────────────────────────────────────
  {
    id: 113,
    missing: [],
    ingredients: [
      { product_id: 8,  quantity: 0.05 },  // Patates
      { product_id: 5,  quantity: 0.035 }, // Kıyma (dana kıyma)
      { product_id: 9,  quantity: 0.006 }, // Soğan
      { product_id: 10, quantity: 0.02 },  // Domates
      { product_id: 11, quantity: 0.01 },  // Biber (kapya)
      { product_id: 18, quantity: 0.005 }, // Domates Salçası
      { product_id: 2,  quantity: 0.03 },  // Bulgur (ince) (pilav)
      { product_id: 43, quantity: 0.025 }, // Marul / Salata Yeşilliği
      { product_id: 26, quantity: 0.015 }, // Salatalık
      { product_id: 17, quantity: 0.006 }, // Sıvı Yağ
      { product_id: 19, quantity: 0.001 }  // Tuz
    ]
  },

  // ──────────────────────────────────────────────────────────
  // 114: Elmalı Kurabiye, Süt (ikindi)
  // ──────────────────────────────────────────────────────────
  {
    id: 114,
    missing: [],
    ingredients: [
      { product_id: 15, quantity: 0.15 },  // Süt (1 bardak)
      { product_id: 20, quantity: 0.025 }, // Un
      { product_id: 25, quantity: 0.025 }, // Elma (iç harç)
      { product_id: 16, quantity: 0.006 }, // Tereyağı
      { product_id: 17, quantity: 0.003 }, // Sıvı Yağ
      { product_id: 42, quantity: 0.006 }  // Şeker
    ]
  },

  // ──────────────────────────────────────────────────────────
  // 115: Meyve Suyu, Sucuklu Tost, Domates, Salatalık (kahvalti)
  // ──────────────────────────────────────────────────────────
  {
    id: 115,
    missing: ['Meyve Suyu', 'Sucuk'],
    ingredients: [
      { product_id: 27, quantity: 0.06 },  // Tam Buğday Ekmeği (tost ekmeği)
      { product_id: 36, quantity: 0.02 },  // Kaşar Peyniri
      { product_id: 16, quantity: 0.003 }, // Tereyağı
      { product_id: 10, quantity: 0.025 }, // Domates
      { product_id: 26, quantity: 0.025 }  // Salatalık
    ]
  },

  // ──────────────────────────────────────────────────────────
  // 116: Mercimek Çorbası, Barbunya, Pirinç Pilavı, Cacık (ogle)
  // ──────────────────────────────────────────────────────────
  {
    id: 116,
    missing: ['Barbunya (Kuru Fasulye muadili kullanıldı)'],
    ingredients: [
      { product_id: 3,  quantity: 0.015 }, // Kırmızı Mercimek
      { product_id: 32, quantity: 0.035 }, // Kuru Fasulye (Barbunya muadili)
      { product_id: 13, quantity: 0.01 },  // Havuç
      { product_id: 9,  quantity: 0.006 }, // Soğan
      { product_id: 18, quantity: 0.005 }, // Domates Salçası
      { product_id: 1,  quantity: 0.03 },  // Pirinç (pilav)
      { product_id: 28, quantity: 0.05 },  // Yoğurt (cacık)
      { product_id: 26, quantity: 0.02 },  // Salatalık (cacık)
      { product_id: 17, quantity: 0.006 }, // Sıvı Yağ
      { product_id: 19, quantity: 0.001 }  // Tuz
    ]
  },

  // ──────────────────────────────────────────────────────────
  // 117: Poğaça, Limonata (ikindi)
  // ──────────────────────────────────────────────────────────
  {
    id: 117,
    missing: ['Limonata'],
    ingredients: [
      { product_id: 20, quantity: 0.035 }, // Un
      { product_id: 22, quantity: 0.015 }, // Beyaz Peynir (iç harç)
      { product_id: 28, quantity: 0.015 }, // Yoğurt
      { product_id: 17, quantity: 0.005 }, // Sıvı Yağ
      { product_id: 21, quantity: 0.1 }    // Yumurta
    ]
  },

  // ──────────────────────────────────────────────────────────
  // 118: Fırında Tavuk, Makarna, Salata (ogle)
  // ──────────────────────────────────────────────────────────
  {
    id: 118,
    missing: [],
    ingredients: [
      { product_id: 6,  quantity: 0.04 },  // Tavuk But (fırın tavuk)
      { product_id: 34, quantity: 0.03 },  // Makarna / Erişte
      { product_id: 18, quantity: 0.004 }, // Domates Salçası (makarna sos)
      { product_id: 43, quantity: 0.025 }, // Marul / Salata Yeşilliği
      { product_id: 10, quantity: 0.015 }, // Domates
      { product_id: 26, quantity: 0.015 }, // Salatalık
      { product_id: 17, quantity: 0.005 }, // Sıvı Yağ
      { product_id: 19, quantity: 0.001 }  // Tuz
    ]
  },

  // ──────────────────────────────────────────────────────────
  // 119: Kakaolu Muhallebi (ikindi)
  // ──────────────────────────────────────────────────────────
  {
    id: 119,
    missing: ['Kakao'],
    ingredients: [
      { product_id: 15, quantity: 0.15 },  // Süt
      { product_id: 20, quantity: 0.015 }, // Un
      { product_id: 42, quantity: 0.01 },  // Şeker
      { product_id: 16, quantity: 0.003 }  // Tereyağı
    ]
  }
];

async function main() {
  const isApply = process.argv.includes('--apply');
  console.log(`\n======================================================`);
  console.log(`🥣 Reçete Doldurma Modu: ${isApply ? 'UYGULANIYOR (DB WRITE)' : 'TEST (DRY-RUN)'}`);
  console.log(`======================================================\n`);

  console.log(`Toplam tanımlanan reçete sayısı: ${recipeDefinitions.length}`);

  // Eksik ürünleri topla
  const allMissing = new Set();
  recipeDefinitions.forEach(r => {
    r.missing.forEach(m => allMissing.add(m));
  });

  console.log(`\n📋 Menüde Geçen Fakat 'products' Tablosunda Bulunmayan Malzemeler:`);
  allMissing.forEach(m => console.log(`   - ${m}`));
  console.log(`\n(Not: Bu malzemeler için otomatik ürün OLUŞTURULMAMIŞTIR, mevcut ürünlerle porsiyonlanmıştır.)\n`);

  if (!isApply) {
    console.log(`Test modu tamamlandı. Değişiklikleri kaydetmek için '--apply' bayrağıyla çalıştırın.`);
    return;
  }

  let totalInserted = 0;
  let updatedRecipes = 0;

  for (const def of recipeDefinitions) {
    // 1. is_draft = true yap
    const { error: updErr } = await supabase
      .from('recipes')
      .update({ is_draft: true })
      .eq('id', def.id);

    if (updErr) {
      console.error(`Reçete #${def.id} is_draft güncellenirken hata:`, updErr.message);
      continue;
    }
    updatedRecipes++;

    // 2. Varsa eski malzemeleri temizle (garanti olsun)
    await supabase
      .from('recipe_ingredients')
      .delete()
      .eq('recipe_id', def.id);

    // 3. Malzemeleri ekle
    const rows = def.ingredients.map(ing => ({
      recipe_id: def.id,
      product_id: ing.product_id,
      quantity_per_portion: ing.quantity
    }));

    const { data: insData, error: insErr } = await supabase
      .from('recipe_ingredients')
      .insert(rows);

    if (insErr) {
      console.error(`Reçete #${def.id} malzemeleri eklenirken hata:`, insErr.message);
    } else {
      totalInserted += rows.length;
    }
  }

  console.log(`\n✅ Başarıyla Tamamlandı!`);
  console.log(`   - Güncellenen ve is_draft=true olarak işaretlenen reçete: ${updatedRecipes}`);
  console.log(`   - Eklenen toplam malzeme satırı (recipe_ingredients): ${totalInserted}\n`);
}

main().catch(err => {
  console.error('Kritik Hata:', err);
  process.exit(1);
});
