const supabase = require('../backend/supabase');

async function seed() {
  console.log('🚀 1 Aylık Menü Tohumlama Başlatılıyor...\n');

  // ─────────────────────────────────────────────────────────
  // 1. YENİ ÜRÜNLER (26 - 43)
  // ─────────────────────────────────────────────────────────
  const newProducts = [
    { id: 26, name: 'Salatalık',                  unit: 'kg',    category: 'sebze',        critical_threshold: 3.0, protein_per_unit: 0.700 },
    { id: 27, name: 'Tam Buğday Ekmeği',         unit: 'adet',  category: 'fırın',        critical_threshold: 10.0,protein_per_unit: 8.500 },
    { id: 28, name: 'Yoğurt',                    unit: 'kg',    category: 'süt ürünleri', critical_threshold: 5.0, protein_per_unit: 3.500 },
    { id: 29, name: 'Kabak',                     unit: 'kg',    category: 'sebze',        critical_threshold: 3.0, protein_per_unit: 1.200 },
    { id: 30, name: 'Muz',                       unit: 'kg',    category: 'meyve',        critical_threshold: 4.0, protein_per_unit: 1.100 },
    { id: 31, name: 'Armut',                     unit: 'kg',    category: 'meyve',        critical_threshold: 3.0, protein_per_unit: 0.400 },
    { id: 32, name: 'Kuru Fasulye (Kuru)',       unit: 'kg',    category: 'bakliyat',     critical_threshold: 5.0, protein_per_unit: 21.000 },
    { id: 33, name: 'Kılçıksız Balık Fileto',   unit: 'kg',    category: 'et & balık',   critical_threshold: 5.0, protein_per_unit: 19.000 },
    { id: 34, name: 'Makarna / Erişte',          unit: 'kg',    category: 'tahıl',        critical_threshold: 5.0, protein_per_unit: 12.000 },
    { id: 35, name: 'Lor Peyniri',               unit: 'kg',    category: 'süt ürünleri', critical_threshold: 2.0, protein_per_unit: 11.000 },
    { id: 36, name: 'Kaşar Peyniri',             unit: 'kg',    category: 'süt ürünleri', critical_threshold: 2.0, protein_per_unit: 25.000 },
    { id: 37, name: 'Kuşbaşı Et (dana)',         unit: 'kg',    category: 'et & balık',   critical_threshold: 5.0, protein_per_unit: 20.000 },
    { id: 38, name: 'Bezelye',                   unit: 'kg',    category: 'sebze',        critical_threshold: 3.0, protein_per_unit: 5.400 },
    { id: 39, name: 'Yeşil Mercimek',            unit: 'kg',    category: 'bakliyat',     critical_threshold: 3.0, protein_per_unit: 24.000 },
    { id: 40, name: 'Tarhana',                   unit: 'kg',    category: 'çorbalık',     critical_threshold: 2.0, protein_per_unit: 12.000 },
    { id: 41, name: 'Böreklik Yufka',            unit: 'kg',    category: 'unlu mamül',   critical_threshold: 2.0, protein_per_unit: 7.000 },
    { id: 42, name: 'Şeker',                     unit: 'kg',    category: 'kuru gıda',    critical_threshold: 2.0, protein_per_unit: 0.000 },
    { id: 43, name: 'Marul / Salata Yeşilliği',  unit: 'kg',    category: 'sebze',        critical_threshold: 2.0, protein_per_unit: 1.200 }
  ];

  console.log('1. Ürünler ekleniyor / güncelleniyor...');
  for (const prod of newProducts) {
    const { error } = await supabase.from('products').upsert(prod, { onConflict: 'id' });
    if (error) console.error(`Ürün ekleme hatası (${prod.name}):`, error.message);
  }
  console.log('✓ 18 yeni ürün başarıyla işlendi.\n');

  // ─────────────────────────────────────────────────────────
  // 2. YENİ ÜRÜNLER İÇİN BAŞLANGIÇ STOĞU
  // ─────────────────────────────────────────────────────────
  console.log('2. Başlangıç stokları ekleniyor...');
  const initialStocks = [
    { product_id: 26, quantity: 20.0 },  // Salatalık 20 kg
    { product_id: 27, quantity: 50.0 },  // Tam Buğday Ekmeği 50 adet
    { product_id: 28, quantity: 30.0 },  // Yoğurt 30 kg
    { product_id: 29, quantity: 20.0 },  // Kabak 20 kg
    { product_id: 30, quantity: 25.0 },  // Muz 25 kg
    { product_id: 31, quantity: 25.0 },  // Armut 25 kg
    { product_id: 32, quantity: 25.0 },  // Kuru Fasulye 25 kg
    { product_id: 33, quantity: 20.0 },  // Balık 20 kg
    { product_id: 34, quantity: 30.0 },  // Makarna 30 kg
    { product_id: 35, quantity: 15.0 },  // Lor Peyniri 15 kg
    { product_id: 36, quantity: 15.0 },  // Kaşar Peyniri 15 kg
    { product_id: 37, quantity: 20.0 },  // Kuşbaşı Et 20 kg
    { product_id: 38, quantity: 15.0 },  // Bezelye 15 kg
    { product_id: 39, quantity: 20.0 },  // Yeşil Mercimek 20 kg
    { product_id: 40, quantity: 10.0 },  // Tarhana 10 kg
    { product_id: 41, quantity: 15.0 },  // Yufka 15 kg
    { product_id: 42, quantity: 15.0 },  // Şeker 15 kg
    { product_id: 43, quantity: 15.0 }   // Yeşillik 15 kg
  ];

  for (const st of initialStocks) {
    const { data: existing } = await supabase
      .from('stock_transactions')
      .select('id')
      .eq('product_id', st.product_id)
      .eq('transaction_type', 'in')
      .limit(1);

    if (!existing || existing.length === 0) {
      await supabase.from('stock_transactions').insert({
        product_id: st.product_id,
        transaction_type: 'in',
        quantity: st.quantity,
        source_type: 'manual',
        transaction_date: new Date().toISOString().split('T')[0]
      });
    }
  }
  console.log('✓ Başlangıç stokları güncellendi.\n');

  // ─────────────────────────────────────────────────────────
  // 3. 4 HAFTANIN TÜM REÇETELERİ (19 - 68)
  // ─────────────────────────────────────────────────────────
  console.log('3. 4 Haftalık reçeteler tanımlanıyor...');
  const recipesList = [
    // ── 1. HAFTA ──
    { id: 19, meal_name: 'Haşlanmış Yumurta, Beyaz Peynir, Ekmek, Salatalık', meal_type: 'kahvalti' },
    { id: 20, meal_name: 'Mercimek Çorbası, Kıymalı Kabak, Bulgur Pilavı, Yoğurt', meal_type: 'ogle' },
    { id: 21, meal_name: 'Mevsim Meyvesi & Süt', meal_type: 'ikindi' },
    { id: 22, meal_name: 'Peynirli Omlet, Ekmek, Domates', meal_type: 'kahvalti' },
    { id: 23, meal_name: 'Fırında Tavuk, Sebzeli Pirinç Pilavı, Cacık', meal_type: 'ogle' },
    { id: 24, meal_name: 'Yoğurt, Yumuşatılmış Yulaf, Muz', meal_type: 'ikindi' },
    { id: 25, meal_name: 'Sütle Hazırlanmış Yulaf Lapası, Armut', meal_type: 'kahvalti' },
    { id: 26, meal_name: 'Kuru Fasulye, Bulgur Pilavı, Mevsim Salatası', meal_type: 'ogle' },
    { id: 27, meal_name: 'Az Şekerli Ev Yapımı Kek, Ayran', meal_type: 'ikindi' },
    { id: 28, meal_name: 'Peynirli Tost, Domates, Süt', meal_type: 'kahvalti' },
    { id: 29, meal_name: 'Sebze Çorbası, Fırında Köfte, Patates Püresi, Yoğurt', meal_type: 'ogle' },
    { id: 30, meal_name: 'Mevsim Meyvesi Tabağı', meal_type: 'ikindi' },
    { id: 31, meal_name: 'Haşlanmış Yumurta, Lor Peyniri, Ekmek, Salatalık', meal_type: 'kahvalti' },
    { id: 32, meal_name: 'Fırında Kılçıksız Balık, Sebzeli Makarna, Salata', meal_type: 'ogle' },
    { id: 33, meal_name: 'Ev Yapımı Peynirli Poğaça, Ayran', meal_type: 'ikindi' },

    // ── 2. HAFTA ──
    { id: 34, meal_name: 'Menemen, Beyaz Peynir, Ekmek', meal_type: 'kahvalti' },
    { id: 35, meal_name: 'Nohut Yemeği, Pirinç Pilavı, Cacık', meal_type: 'ogle' },
    { id: 36, meal_name: 'Mevsim Meyvesi & Yoğurt', meal_type: 'ikindi' },
    { id: 37, meal_name: 'Peynirli Krep, Salatalık, Süt', meal_type: 'kahvalti' },
    { id: 38, meal_name: 'Tarhana Çorbası, Etli Taze Fasulye, Bulgur Pilavı', meal_type: 'ogle' },
    { id: 39, meal_name: 'Muzlu Yulaflı Ev Kurabiyesi, Süt', meal_type: 'ikindi' },
    { id: 40, meal_name: 'Haşlanmış Yumurta, Peynir, Ekmek, Domates', meal_type: 'kahvalti' },
    { id: 41, meal_name: 'Sebzeli Tavuk Sote, Makarna, Yoğurt', meal_type: 'ogle' },
    { id: 42, meal_name: 'Mevsim Meyvesi & Ayran', meal_type: 'ikindi' },
    { id: 43, meal_name: 'Sütlü Yulaf Lapası, Muz', meal_type: 'kahvalti' },
    { id: 44, meal_name: 'Yeşil Mercimek Yemeği, Sebzeli Bulgur Pilavı, Yoğurt', meal_type: 'ogle' },
    { id: 45, meal_name: 'Fırında Peynirli Börek, Domates', meal_type: 'ikindi' },
    { id: 46, meal_name: 'Peynirli Omlet, Ekmek, Salatalık', meal_type: 'kahvalti' },
    { id: 47, meal_name: 'Yayla Çorbası, Kıymalı Sebze Dolması, Salata', meal_type: 'ogle' },
    { id: 48, meal_name: 'Az Şekerli Sütlaç', meal_type: 'ikindi' },

    // ── 3. HAFTA ──
    { id: 49, meal_name: 'Sebze Çorbası, Fırında Tavuk, Bulgur Pilavı, Cacık', meal_type: 'ogle' },
    { id: 50, meal_name: 'Peynirli Tost, Salatalık, Süt', meal_type: 'kahvalti' },
    { id: 51, meal_name: 'Etli Bezelye, Pirinç Pilavı, Yoğurt', meal_type: 'ogle' },
    { id: 52, meal_name: 'Elmalı Yoğurt, Yumuşatılmış Yulaf', meal_type: 'ikindi' },
    { id: 53, meal_name: 'Sebzeli Omlet, Ekmek', meal_type: 'kahvalti' },
    { id: 54, meal_name: 'Fırında Kılçıksız Balık, Fırın Patates, Yoğurtlu Havuç', meal_type: 'ogle' },
    { id: 55, meal_name: 'Mevsim Meyvesi, Peynirli Küçük Sandviç', meal_type: 'ikindi' },
    { id: 56, meal_name: 'Mercimek Çorbası, Fırında Sebzeli Mücver, Yoğurt', meal_type: 'ogle' },
    { id: 57, meal_name: 'Az Şekerli Ev Yapımı Kek, Süt', meal_type: 'ikindi' },

    // ── 4. HAFTA ──
    { id: 58, meal_name: 'Etli Nohut, Bulgur Pilavı, Cacık', meal_type: 'ogle' },
    { id: 59, meal_name: 'Peynirli Krep, Domates, Süt', meal_type: 'kahvalti' },
    { id: 60, meal_name: 'Sebze Çorbası, Fırında Köfte, Sebzeli Makarna, Salata', meal_type: 'ogle' },
    { id: 61, meal_name: 'Muz, Süt', meal_type: 'ikindi' },
    { id: 62, meal_name: 'Tavuklu Sebze Yemeği, Pirinç Pilavı, Yoğurt', meal_type: 'ogle' },
    { id: 63, meal_name: 'Fırında Peynirli Börek, Ayran', meal_type: 'ikindi' },
    { id: 64, meal_name: 'Sütlü Yulaf Lapası, Elma', meal_type: 'kahvalti' },
    { id: 65, meal_name: 'Yeşil Mercimek Yemeği, Erişte, Cacık', meal_type: 'ogle' },
    { id: 66, meal_name: 'Tarhana Çorbası, Kıymalı Ispanak, Bulgur Pilavı, Yoğurt', meal_type: 'ogle' },
    { id: 67, meal_name: 'Az Şekerli Muhallebi, Mevsim Meyvesi', meal_type: 'ikindi' }
  ];

  for (const rec of recipesList) {
    const { error } = await supabase.from('recipes').upsert({
      id: rec.id,
      meal_name: rec.meal_name,
      meal_type: rec.meal_type
    }, { onConflict: 'id' });
    if (error) console.error(`Reçete ekleme hatası (${rec.meal_name}):`, error.message);
  }
  console.log('✓ Tüm reçeteler kaydedildi.\n');

  // ─────────────────────────────────────────────────────────
  // 4. REÇETE MALZEMELERİ (recipe_ingredients)
  // ─────────────────────────────────────────────────────────
  console.log('4. Reçete malzeme gramajları tanımlanıyor...');
  const ingMap = [
    // 19: Haşlanmış Yumurta, Beyaz Peynir, Ekmek, Salatalık (K)
    { r: 19, p: 21, q: 1.0 },    // Yumurta
    { r: 19, p: 22, q: 0.035 },  // Beyaz Peynir
    { r: 19, p: 27, q: 0.05 },   // Ekmek
    { r: 19, p: 26, q: 0.04 },   // Salatalık

    // 20: Mercimek Çorbası, Kıymalı Kabak, Bulgur Pilavı, Yoğurt (O)
    { r: 20, p: 3,  q: 0.025 },  // Kırmızı Mercimek
    { r: 20, p: 5,  q: 0.035 },  // Kıyma
    { r: 20, p: 29, q: 0.06 },   // Kabak
    { r: 20, p: 2,  q: 0.035 },  // Bulgur
    { r: 20, p: 28, q: 0.08 },   // Yoğurt
    { r: 20, p: 17, q: 0.005 },  // Sıvı Yağ
    { r: 20, p: 19, q: 0.001 },  // Tuz

    // 21: Mevsim Meyvesi & Süt (I)
    { r: 21, p: 25, q: 0.08 },   // Elma
    { r: 21, p: 15, q: 0.15 },   // Süt

    // 22: Peynirli Omlet, Ekmek, Domates (K)
    { r: 22, p: 21, q: 1.0 },    // Yumurta
    { r: 22, p: 22, q: 0.03 },   // Beyaz Peynir
    { r: 22, p: 27, q: 0.05 },   // Ekmek
    { r: 22, p: 10, q: 0.03 },   // Domates
    { r: 22, p: 16, q: 0.005 },  // Tereyağı

    // 23: Fırında Tavuk, Sebzeli Pirinç Pilavı, Cacık (O)
    { r: 23, p: 6,  q: 0.065 },  // Tavuk But
    { r: 23, p: 1,  q: 0.035 },  // Pirinç
    { r: 23, p: 38, q: 0.015 },  // Bezelye
    { r: 23, p: 13, q: 0.01 },   // Havuç
    { r: 23, p: 28, q: 0.06 },   // Yoğurt
    { r: 23, p: 26, q: 0.03 },   // Salatalık
    { r: 23, p: 17, q: 0.005 },  // Sıvı Yağ
    { r: 23, p: 19, q: 0.001 },  // Tuz

    // 24: Yoğurt, Yumuşatılmış Yulaf, Muz (I)
    { r: 24, p: 28, q: 0.08 },   // Yoğurt
    { r: 24, p: 24, q: 0.025 },  // Yulaf
    { r: 24, p: 30, q: 0.06 },   // Muz

    // 25: Sütle Hazırlanmış Yulaf Lapası, Armut (K)
    { r: 25, p: 24, q: 0.035 },  // Yulaf
    { r: 25, p: 15, q: 0.15 },   // Süt
    { r: 25, p: 31, q: 0.06 },   // Armut

    // 26: Kuru Fasulye, Bulgur Pilavı, Mevsim Salatası (O)
    { r: 26, p: 32, q: 0.045 },  // Kuru Fasulye
    { r: 26, p: 9,  q: 0.015 },  // Soğan
    { r: 26, p: 18, q: 0.01 },   // Salça
    { r: 26, p: 2,  q: 0.035 },  // Bulgur
    { r: 26, p: 43, q: 0.04 },   // Yeşillik
    { r: 26, p: 10, q: 0.02 },   // Domates
    { r: 26, p: 19, q: 0.001 },  // Tuz

    // 27: Az Şekerli Ev Yapımı Kek, Ayran (I)
    { r: 27, p: 20, q: 0.035 },  // Un
    { r: 27, p: 21, q: 0.25 },   // Yumurta
    { r: 27, p: 42, q: 0.008 },  // Şeker
    { r: 27, p: 17, q: 0.006 },  // Sıvı Yağ
    { r: 27, p: 28, q: 0.06 },   // Yoğurt (ayran)

    // 28: Peynirli Tost, Domates, Süt (K)
    { r: 28, p: 27, q: 0.08 },   // Ekmek
    { r: 28, p: 36, q: 0.03 },   // Kaşar Peyniri
    { r: 28, p: 10, q: 0.03 },   // Domates
    { r: 28, p: 15, q: 0.15 },   // Süt

    // 29: Sebze Çorbası, Fırında Köfte, Patates Püresi, Yoğurt (O)
    { r: 29, p: 13, q: 0.015 },  // Havuç
    { r: 29, p: 29, q: 0.015 },  // Kabak
    { r: 29, p: 5,  q: 0.045 },  // Kıyma
    { r: 29, p: 8,  q: 0.06 },   // Patates
    { r: 29, p: 15, q: 0.03 },   // Süt
    { r: 29, p: 28, q: 0.06 },   // Yoğurt
    { r: 29, p: 19, q: 0.001 },  // Tuz

    // 30: Mevsim Meyvesi Tabağı (I)
    { r: 30, p: 25, q: 0.06 },   // Elma
    { r: 30, p: 31, q: 0.06 },   // Armut

    // 31: Haşlanmış Yumurta, Lor Peyniri, Ekmek, Salatalık (K)
    { r: 31, p: 21, q: 1.0 },    // Yumurta
    { r: 31, p: 35, q: 0.035 },  // Lor Peyniri
    { r: 31, p: 27, q: 0.05 },   // Ekmek
    { r: 31, p: 26, q: 0.04 },   // Salatalık

    // 32: Fırında Kılçıksız Balık, Sebzeli Makarna, Salata (O)
    { r: 32, p: 33, q: 0.07 },   // Kılçıksız Balık
    { r: 32, p: 34, q: 0.04 },   // Makarna
    { r: 32, p: 13, q: 0.015 },  // Havuç
    { r: 32, p: 43, q: 0.04 },   // Salata
    { r: 32, p: 17, q: 0.005 },  // Sıvı Yağ
    { r: 32, p: 19, q: 0.001 },  // Tuz

    // 33: Ev Yapımı Peynirli Poğaça, Ayran (I)
    { r: 33, p: 20, q: 0.04 },   // Un
    { r: 33, p: 22, q: 0.02 },   // Peynir
    { r: 33, p: 16, q: 0.008 },  // Tereyağı
    { r: 33, p: 28, q: 0.08 },   // Yoğurt (ayran)
    { r: 33, p: 21, q: 0.2 },    // Yumurta

    // 34: Menemen, Beyaz Peynir, Ekmek (K)
    { r: 34, p: 21, q: 1.0 },    // Yumurta
    { r: 34, p: 10, q: 0.05 },   // Domates
    { r: 34, p: 11, q: 0.02 },   // Biber
    { r: 34, p: 22, q: 0.025 },  // Beyaz Peynir
    { r: 34, p: 27, q: 0.05 },   // Ekmek

    // 35: Nohut Yemeği, Pirinç Pilavı, Cacık (O)
    { r: 35, p: 4,  q: 0.045 },  // Nohut
    { r: 35, p: 18, q: 0.01 },   // Salça
    { r: 35, p: 1,  q: 0.035 },  // Pirinç
    { r: 35, p: 28, q: 0.06 },   // Yoğurt
    { r: 35, p: 26, q: 0.03 },   // Salatalık
    { r: 35, p: 19, q: 0.001 },  // Tuz

    // 36: Mevsim Meyvesi & Yoğurt (I)
    { r: 36, p: 25, q: 0.08 },   // Elma
    { r: 36, p: 28, q: 0.08 },   // Yoğurt

    // 37: Peynirli Krep, Salatalık, Süt (K)
    { r: 37, p: 20, q: 0.035 },  // Un
    { r: 37, p: 15, q: 0.15 },   // Süt
    { r: 37, p: 21, q: 0.5 },    // Yumurta
    { r: 37, p: 22, q: 0.025 },  // Beyaz Peynir
    { r: 37, p: 26, q: 0.035 },  // Salatalık

    // 38: Tarhana Çorbası, Etli Taze Fasulye, Bulgur Pilavı (O)
    { r: 38, p: 40, q: 0.025 },  // Tarhana
    { r: 38, p: 37, q: 0.035 },  // Kuşbaşı Et
    { r: 38, p: 14, q: 0.06 },   // Taze Fasulye
    { r: 38, p: 2,  q: 0.035 },  // Bulgur
    { r: 38, p: 18, q: 0.008 },  // Salça
    { r: 38, p: 19, q: 0.001 },  // Tuz

    // 39: Muzlu Yulaflı Ev Kurabiyesi, Süt (I)
    { r: 39, p: 24, q: 0.03 },   // Yulaf
    { r: 39, p: 30, q: 0.04 },   // Muz
    { r: 39, p: 20, q: 0.015 },  // Un
    { r: 39, p: 15, q: 0.15 },   // Süt

    // 40: Haşlanmış Yumurta, Peynir, Ekmek, Domates (K)
    { r: 40, p: 21, q: 1.0 },    // Yumurta
    { r: 40, p: 22, q: 0.035 },  // Beyaz Peynir
    { r: 40, p: 27, q: 0.05 },   // Ekmek
    { r: 40, p: 10, q: 0.04 },   // Domates

    // 41: Sebzeli Tavuk Sote, Makarna, Yoğurt (O)
    { r: 41, p: 7,  q: 0.055 },  // Tavuk Göğüs
    { r: 41, p: 11, q: 0.02 },   // Biber
    { r: 41, p: 10, q: 0.02 },   // Domates
    { r: 41, p: 34, q: 0.04 },   // Makarna
    { r: 41, p: 28, q: 0.06 },   // Yoğurt
    { r: 41, p: 19, q: 0.001 },  // Tuz

    // 42: Mevsim Meyvesi & Ayran (I)
    { r: 42, p: 31, q: 0.08 },   // Armut
    { r: 42, p: 28, q: 0.06 },   // Yoğurt (ayran)

    // 43: Sütlü Yulaf Lapası, Muz (K)
    { r: 43, p: 24, q: 0.035 },  // Yulaf
    { r: 43, p: 15, q: 0.15 },   // Süt
    { r: 43, p: 30, q: 0.06 },   // Muz

    // 44: Yeşil Mercimek Yemeği, Sebzeli Bulgur Pilavı, Yoğurt (O)
    { r: 44, p: 39, q: 0.04 },   // Yeşil Mercimek
    { r: 44, p: 13, q: 0.015 },  // Havuç
    { r: 44, p: 2,  q: 0.035 },  // Bulgur
    { r: 44, p: 28, q: 0.06 },   // Yoğurt
    { r: 44, p: 18, q: 0.008 },  // Salça
    { r: 44, p: 19, q: 0.001 },  // Tuz

    // 45: Fırında Peynirli Börek, Domates (I)
    { r: 45, p: 41, q: 0.04 },   // Yufka
    { r: 45, p: 22, q: 0.025 },  // Peynir
    { r: 45, p: 21, q: 0.2 },    // Yumurta
    { r: 45, p: 10, q: 0.03 },   // Domates

    // 46: Peynirli Omlet, Ekmek, Salatalık (K)
    { r: 46, p: 21, q: 1.0 },    // Yumurta
    { r: 46, p: 22, q: 0.03 },   // Peynir
    { r: 46, p: 27, q: 0.05 },   // Ekmek
    { r: 46, p: 26, q: 0.04 },   // Salatalık

    // 47: Yayla Çorbası, Kıymalı Sebze Dolması, Salata (O)
    { r: 47, p: 28, q: 0.04 },   // Yoğurt
    { r: 47, p: 1,  q: 0.015 },  // Pirinç
    { r: 47, p: 5,  q: 0.035 },  // Kıyma
    { r: 47, p: 29, q: 0.06 },   // Kabak
    { r: 47, p: 43, q: 0.04 },   // Salata
    { r: 47, p: 19, q: 0.001 },  // Tuz

    // 48: Az Şekerli Sütlaç (I)
    { r: 48, p: 15, q: 0.15 },   // Süt
    { r: 48, p: 1,  q: 0.02 },   // Pirinç
    { r: 48, p: 42, q: 0.01 },   // Şeker

    // 49: Sebze Çorbası, Fırında Tavuk, Bulgur Pilavı, Cacık (O)
    { r: 49, p: 13, q: 0.015 },  // Havuç
    { r: 49, p: 6,  q: 0.065 },  // Tavuk But
    { r: 49, p: 2,  q: 0.035 },  // Bulgur
    { r: 49, p: 28, q: 0.06 },   // Yoğurt
    { r: 49, p: 26, q: 0.03 },   // Salatalık
    { r: 49, p: 19, q: 0.001 },  // Tuz

    // 50: Peynirli Tost, Salatalık, Süt (K)
    { r: 50, p: 27, q: 0.08 },   // Ekmek
    { r: 50, p: 36, q: 0.03 },   // Kaşar Peyniri
    { r: 50, p: 26, q: 0.04 },   // Salatalık
    { r: 50, p: 15, q: 0.15 },   // Süt

    // 51: Etli Bezelye, Pirinç Pilavı, Yoğurt (O)
    { r: 51, p: 37, q: 0.035 },  // Kuşbaşı Et
    { r: 51, p: 38, q: 0.06 },   // Bezelye
    { r: 51, p: 13, q: 0.02 },   // Havuç
    { r: 51, p: 1,  q: 0.035 },  // Pirinç
    { r: 51, p: 28, q: 0.06 },   // Yoğurt
    { r: 51, p: 19, q: 0.001 },  // Tuz

    // 52: Elmalı Yoğurt, Yumuşatılmış Yulaf (I)
    { r: 52, p: 28, q: 0.08 },   // Yoğurt
    { r: 52, p: 25, q: 0.06 },   // Elma
    { r: 52, p: 24, q: 0.025 },  // Yulaf

    // 53: Sebzeli Omlet, Ekmek (K)
    { r: 53, p: 21, q: 1.0 },    // Yumurta
    { r: 53, p: 10, q: 0.025 },  // Domates
    { r: 53, p: 11, q: 0.02 },   // Biber
    { r: 53, p: 27, q: 0.05 },   // Ekmek
    { r: 53, p: 16, q: 0.005 },  // Tereyağı

    // 54: Fırında Kılçıksız Balık, Fırın Patates, Yoğurtlu Havuç (O)
    { r: 54, p: 33, q: 0.07 },   // Balık
    { r: 54, p: 8,  q: 0.06 },   // Patates
    { r: 54, p: 13, q: 0.04 },   // Havuç
    { r: 54, p: 28, q: 0.05 },   // Yoğurt
    { r: 54, p: 19, q: 0.001 },  // Tuz

    // 55: Mevsim Meyvesi, Peynirli Küçük Sandviç (I)
    { r: 55, p: 27, q: 0.04 },   // Ekmek
    { r: 55, p: 22, q: 0.02 },   // Peynir
    { r: 55, p: 25, q: 0.06 },   // Elma

    // 56: Mercimek Çorbası, Fırında Sebzeli Mücver, Yoğurt (O)
    { r: 56, p: 3,  q: 0.025 },  // Mercimek
    { r: 56, p: 29, q: 0.06 },   // Kabak
    { r: 56, p: 13, q: 0.02 },   // Havuç
    { r: 56, p: 21, q: 0.3 },    // Yumurta
    { r: 56, p: 20, q: 0.015 },  // Un
    { r: 56, p: 28, q: 0.06 },   // Yoğurt
    { r: 56, p: 19, q: 0.001 },  // Tuz

    // 57: Az Şekerli Ev Yapımı Kek, Süt (I)
    { r: 57, p: 20, q: 0.035 },  // Un
    { r: 57, p: 21, q: 0.25 },   // Yumurta
    { r: 57, p: 42, q: 0.008 },  // Şeker
    { r: 57, p: 15, q: 0.15 },   // Süt

    // 58: Etli Nohut, Bulgur Pilavı, Cacık (O)
    { r: 58, p: 37, q: 0.03 },   // Kuşbaşı Et
    { r: 58, p: 4,  q: 0.04 },   // Nohut
    { r: 58, p: 2,  q: 0.035 },  // Bulgur
    { r: 58, p: 28, q: 0.06 },   // Yoğurt
    { r: 58, p: 26, q: 0.03 },   // Salatalık
    { r: 58, p: 19, q: 0.001 },  // Tuz

    // 59: Peynirli Krep, Domates, Süt (K)
    { r: 59, p: 20, q: 0.035 },  // Un
    { r: 59, p: 15, q: 0.15 },   // Süt
    { r: 59, p: 21, q: 0.5 },    // Yumurta
    { r: 59, p: 22, q: 0.025 },  // Peynir
    { r: 59, p: 10, q: 0.035 },  // Domates

    // 60: Sebze Çorbası, Fırında Köfte, Sebzeli Makarna, Salata (O)
    { r: 60, p: 13, q: 0.015 },  // Havuç
    { r: 60, p: 5,  q: 0.045 },  // Kıyma
    { r: 60, p: 34, q: 0.035 },  // Makarna
    { r: 60, p: 43, q: 0.04 },   // Salata
    { r: 60, p: 19, q: 0.001 },  // Tuz

    // 61: Muz, Süt (I)
    { r: 61, p: 30, q: 0.08 },   // Muz
    { r: 61, p: 15, q: 0.15 },   // Süt

    // 62: Tavuklu Sebze Yemeği, Pirinç Pilavı, Yoğurt (O)
    { r: 62, p: 7,  q: 0.055 },  // Tavuk Göğüs
    { r: 62, p: 29, q: 0.03 },   // Kabak
    { r: 62, p: 8,  q: 0.03 },   // Patates
    { r: 62, p: 1,  q: 0.035 },  // Pirinç
    { r: 62, p: 28, q: 0.06 },   // Yoğurt
    { r: 62, p: 19, q: 0.001 },  // Tuz

    // 63: Fırında Peynirli Börek, Ayran (I)
    { r: 63, p: 41, q: 0.04 },   // Yufka
    { r: 63, p: 22, q: 0.025 },  // Peynir
    { r: 63, p: 21, q: 0.2 },    // Yumurta
    { r: 63, p: 28, q: 0.08 },   // Yoğurt (ayran)

    // 64: Sütlü Yulaf Lapası, Elma (K)
    { r: 64, p: 24, q: 0.035 },  // Yulaf
    { r: 64, p: 15, q: 0.15 },   // Süt
    { r: 64, p: 25, q: 0.06 },   // Elma

    // 65: Yeşil Mercimek Yemeği, Erişte, Cacık (O)
    { r: 65, p: 39, q: 0.04 },   // Yeşil Mercimek
    { r: 65, p: 34, q: 0.04 },   // Erişte
    { r: 65, p: 28, q: 0.06 },   // Yoğurt
    { r: 65, p: 26, q: 0.03 },   // Salatalık
    { r: 65, p: 19, q: 0.001 },  // Tuz

    // 66: Tarhana Çorbası, Kıymalı Ispanak, Bulgur Pilavı, Yoğurt (O)
    { r: 66, p: 40, q: 0.025 },  // Tarhana
    { r: 66, p: 5,  q: 0.035 },  // Kıyma
    { r: 66, p: 12, q: 0.07 },   // Ispanak
    { r: 66, p: 2,  q: 0.035 },  // Bulgur
    { r: 66, p: 28, q: 0.06 },   // Yoğurt
    { r: 66, p: 19, q: 0.001 },  // Tuz

    // 67: Az Şekerli Muhallebi, Mevsim Meyvesi (I)
    { r: 67, p: 15, q: 0.15 },   // Süt
    { r: 67, p: 20, q: 0.02 },   // Un / Nişasta
    { r: 67, p: 42, q: 0.01 },   // Şeker
    { r: 67, p: 25, q: 0.05 }    // Meyve
  ];

  // Eski malzemeleri temizleyip yeni malzemeleri ekle (19 - 68)
  await supabase.from('recipe_ingredients').delete().gte('recipe_id', 19);

  const batchSize = 40;
  for (let i = 0; i < ingMap.length; i += batchSize) {
    const chunk = ingMap.slice(i, i + batchSize).map(item => ({
      recipe_id: item.r,
      product_id: item.p,
      quantity_per_portion: item.q
    }));
    const { error } = await supabase.from('recipe_ingredients').insert(chunk);
    if (error) console.error('Malzeme insert hatası:', error.message);
  }
  console.log(`✓ ${ingMap.length} porsiyon malzeme gramajı başarıyla eklendi.\n`);

  // ─────────────────────────────────────────────────────────
  // 5. 4 HAFTALIK MENÜ EŞLEŞTİRMESİ (weekly_menu)
  // ─────────────────────────────────────────────────────────
  console.log('5. 4 Haftalık menü haritası hazırlanıyor...');
  const monthlyPlan = [
    // ── 1. HAFTA ──
    { week: 1, day: 1, type: 'kahvalti', recipe: 19 },
    { week: 1, day: 1, type: 'ogle',     recipe: 20 },
    { week: 1, day: 1, type: 'ikindi',   recipe: 21 },
    { week: 1, day: 2, type: 'kahvalti', recipe: 22 },
    { week: 1, day: 2, type: 'ogle',     recipe: 23 },
    { week: 1, day: 2, type: 'ikindi',   recipe: 24 },
    { week: 1, day: 3, type: 'kahvalti', recipe: 25 },
    { week: 1, day: 3, type: 'ogle',     recipe: 26 },
    { week: 1, day: 3, type: 'ikindi',   recipe: 27 },
    { week: 1, day: 4, type: 'kahvalti', recipe: 28 },
    { week: 1, day: 4, type: 'ogle',     recipe: 29 },
    { week: 1, day: 4, type: 'ikindi',   recipe: 30 },
    { week: 1, day: 5, type: 'kahvalti', recipe: 31 },
    { week: 1, day: 5, type: 'ogle',     recipe: 32 },
    { week: 1, day: 5, type: 'ikindi',   recipe: 33 },

    // ── 2. HAFTA ──
    { week: 2, day: 1, type: 'kahvalti', recipe: 34 },
    { week: 2, day: 1, type: 'ogle',     recipe: 35 },
    { week: 2, day: 1, type: 'ikindi',   recipe: 36 },
    { week: 2, day: 2, type: 'kahvalti', recipe: 37 },
    { week: 2, day: 2, type: 'ogle',     recipe: 38 },
    { week: 2, day: 2, type: 'ikindi',   recipe: 39 },
    { week: 2, day: 3, type: 'kahvalti', recipe: 40 },
    { week: 2, day: 3, type: 'ogle',     recipe: 41 },
    { week: 2, day: 3, type: 'ikindi',   recipe: 42 },
    { week: 2, day: 4, type: 'kahvalti', recipe: 43 },
    { week: 2, day: 4, type: 'ogle',     recipe: 44 },
    { week: 2, day: 4, type: 'ikindi',   recipe: 45 },
    { week: 2, day: 5, type: 'kahvalti', recipe: 46 },
    { week: 2, day: 5, type: 'ogle',     recipe: 47 },
    { week: 2, day: 5, type: 'ikindi',   recipe: 48 },

    // ── 3. HAFTA ──
    { week: 3, day: 1, type: 'kahvalti', recipe: 40 },
    { week: 3, day: 1, type: 'ogle',     recipe: 49 },
    { week: 3, day: 1, type: 'ikindi',   recipe: 21 },
    { week: 3, day: 2, type: 'kahvalti', recipe: 50 },
    { week: 3, day: 2, type: 'ogle',     recipe: 51 },
    { week: 3, day: 2, type: 'ikindi',   recipe: 52 },
    { week: 3, day: 3, type: 'kahvalti', recipe: 53 },
    { week: 3, day: 3, type: 'ogle',     recipe: 26 },
    { week: 3, day: 3, type: 'ikindi',   recipe: 33 },
    { week: 3, day: 4, type: 'kahvalti', recipe: 25 },
    { week: 3, day: 4, type: 'ogle',     recipe: 54 },
    { week: 3, day: 4, type: 'ikindi',   recipe: 55 },
    { week: 3, day: 5, type: 'kahvalti', recipe: 31 },
    { week: 3, day: 5, type: 'ogle',     recipe: 56 },
    { week: 3, day: 5, type: 'ikindi',   recipe: 57 },

    // ── 4. HAFTA ──
    { week: 4, day: 1, type: 'kahvalti', recipe: 34 },
    { week: 4, day: 1, type: 'ogle',     recipe: 58 },
    { week: 4, day: 1, type: 'ikindi',   recipe: 36 },
    { week: 4, day: 2, type: 'kahvalti', recipe: 59 },
    { week: 4, day: 2, type: 'ogle',     recipe: 60 },
    { week: 4, day: 2, type: 'ikindi',   recipe: 61 },
    { week: 4, day: 3, type: 'kahvalti', recipe: 19 },
    { week: 4, day: 3, type: 'ogle',     recipe: 62 },
    { week: 4, day: 3, type: 'ikindi',   recipe: 63 },
    { week: 4, day: 4, type: 'kahvalti', recipe: 64 },
    { week: 4, day: 4, type: 'ogle',     recipe: 65 },
    { week: 4, day: 4, type: 'ikindi',   recipe: 55 },
    { week: 4, day: 5, type: 'kahvalti', recipe: 22 },
    { week: 4, day: 5, type: 'ogle',     recipe: 66 },
    { week: 4, day: 5, type: 'ikindi',   recipe: 67 }
  ];

  // Haftalık menüye ekle (Pazartesi başlangıçlı gerçek takvim)
  // Hafta 1: 2026-09-07 (Pzt), Hafta 2: 2026-09-14 (Pzt), Hafta 3: 2026-09-21 (Pzt), Hafta 4: 2026-09-28 (Pzt)
  const baseDates = {
    1: '2026-09-07',
    2: '2026-09-14',
    3: '2026-09-21',
    4: '2026-09-28'
  };

  // Önce week_number ile deniyoruz
  let withWeekNumberSuccess = false;
  try {
    const testRow = { week_number: 1, day_of_week: 1, recipe_id: 19, meal_type: 'kahvalti', valid_from: '2026-09-01' };
    const { data: insertedT, error: tErr } = await supabase.from('weekly_menu').insert(testRow).select();
    if (!tErr && insertedT && insertedT.length > 0) {
      withWeekNumberSuccess = true;
      console.log('✓ weekly_menu tablosunda week_number kolonu mevcut!');
      await supabase.from('weekly_menu').delete().eq('id', insertedT[0].id);
    }
  } catch (e) {
    withWeekNumberSuccess = false;
  }

  // Eski 19+ reçete menülerini temizle
  await supabase.from('weekly_menu').delete().gte('recipe_id', 19);

  const menuRowsToInsert = monthlyPlan.map(item => {
    const row = {
      day_of_week: item.day,
      recipe_id: item.recipe,
      meal_type: item.type,
      valid_from: baseDates[item.week]
    };
    if (withWeekNumberSuccess) {
      row.week_number = item.week;
    }
    return row;
  });

  const { error: mErr } = await supabase.from('weekly_menu').insert(menuRowsToInsert);
  if (mErr) {
    console.error('Menü insert hatası:', mErr.message);
  } else {
    console.log(`✓ 4 haftanın 60 öğünlük menüsü başarıyla kaydedildi! (${withWeekNumberSuccess ? 'week_number kolonu ile' : 'tarih ve gün bazlı'})`);
  }

  console.log('\n🎉 1 Aylık Menü Tohumlama Tamamlandı!');
}

seed().catch(console.error);
