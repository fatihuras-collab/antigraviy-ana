# Pera Anaokulu Stok Takip & Tüketim Sistemi — Geliştirme Kuralları

Bu dosya, projede yapılacak tüm geliştirme, hata düzeltme ve refaktör işlemlerinde uyulması zorunlu kuralları içerir. **Her görev öncesinde bu dosya okunmalı ve kurallara eksiksiz uyulmalıdır.**

---

## 1. Çift Frontend Dizin Senkronizasyonu (KRİTİK)
- Projede hem `backend/public/` hem de `frontend/` dizinleri bulunmaktadır.
- Statik arayüz dosyalarında (`index.html`, `style.css`, `app.js`, `manifest.json`, `sw.js`, PWA ikonları vb.) yapılan her değişiklik **her iki dizinde de eşzamanlı olarak birebir aynı (byte-for-byte)** tutulmalıdır.
- Dosya güncellemelerinde tarayıcı önbellek sorunlarını (caching) önlemek için `index.html` içerisindeki `v=X.X.X` versiyon numaraları artırılmalıdır.

---

## 2. Test ve Doğrulama Zorunluluğu
- Bir değişiklik yapıldıktan sonra asla *"ekledim/düzelttim"* deyip geçilmeyecektir.
- Yerel sunucu (`node backend/server.js`) ayağa kaldırılarak:
  1. İlgili API uç noktaları (`curl` / `node` fetch) ile test edilecek,
  2. Tarayıcıda (Edge/Chrome CDP otomasyonu ile) konsol hataları (`console.error`) kontrol edilecek,
  3. UI bileşenlerinin (butonlar, modallar, filtreler) tıklanabilirliği ve DOM yansımaları bizzat doğrulanacaktır.

---

## 3. Mobil Uyumluluk ve PWA Desteği
- Yapılan tüm görsel düzenlemeler hem masaüstü hem de mobil (dar ekran, örn: 375px) ekran genişliklerinde test edilmelidir.
- Taşma (`overflow`), butonların birbirine girmesi veya tıklanamaz hale gelmesi engellenmelidir.
- PWA manifest (`manifest.json`) ve Service Worker (`sw.js`) bütünlüğü korunmalıdır.

---

## 4. Veri Bütünlüğü ve Sıfırlama Kuralları
- Sistem sıfırlama işlemlerinde (`/api/settings/reset-system`):
  - ✅ Temizlenenler: `stock_transactions`, güncel stok miktarları (`current_stock = 0`), öğün geri bildirimleri / test kayıtları.
  - ⛔ **Kesinlikle Dokunulmayacak Olanlar:** Ürün tanımları (`products`), reçeteler (`recipes`), aylık yemek planı (`monthly_menu`) ve birim alış fiyatları (`unit_price`).

---

## 5. Zaman Dilimi Standartları
- Tüm zamanlayıcılar (`schedulerService.js`), raporlama saatleri ve tarih filtreleri Türkiye Saati (`Europe/Istanbul` - TSİ) standardına göre çalışmalıdır.

---

## 6. Git ve Canlı Dağıtım (Push) Kuralları
- İş tamamlandığında değişiklikler `git add` ve açıklayıcı bir `git commit` mesajı ile paketlenmeli,
- `git push origin main` ile uzak sunucuya (GitHub / Railway) gönderilmeli,
- Kullanıcıya işlemin tamamlandığı teyidi ile birlikte **commit numarası (hash)** raporlanmalıdır.
