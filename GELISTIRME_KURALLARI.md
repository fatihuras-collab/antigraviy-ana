# GELİŞTİRME KURALLARI

Bu projede kod yazarken, deploy ederken ve değişiklik yaparken aşağıdaki kurallara uy. Bunlar önceki projede pahalı derslerle öğrenilmiş prensiplerdir.

---

## Mimari
- **Dinamik Veriler:** Sık değişen veri (menü, fiyat, stok gibi) veritabanına aittir, kodun içine gömülmez. Koda gömülürse her değişiklikte yeniden deploy gerekir.
- **Gizli Bilgiler:** Hassas veriler (API anahtarı, token, şifre) koda gömülmez; `process.env` üzerinden environment değişkeninden okunur. Değişken adı birebir tutarlı olmalıdır.
- **Frontend Dizin Senkronizasyonu:** Projede statik dosyalar hem `backend/public/` hem de `frontend/` dizinlerinde yer alır. Yapılan her arayüz değişikliği her iki klasörde de birebir aynı (senkronize) tutulmalı ve versiyon numarası (`v=X.X.X`) güncellenmelidir.

---

## Deploy ve Doğrulama
- **Gerçek Push Kontrolü:** Bir özellik eklediğini söylemeden önce gerçekten commit'leyip push ettiğinden emin ol. "Ekledim" deyip geçme; kodun dosyaya işlendiğini ve push edildiğini doğrula.
- **Başlangıç Logları:** Yeni bir endpoint eklediğinde, uygulamanın başlangıç loglarında (`server.js`) görünecek şekilde listele — böylece canlıda (Railway) olup olmadığı loglardan doğrulanabilsin.
- **Commit Raporu:** Değişiklik sonrası commit numarasını (hash) bildir.

---

## Test ve Loglama
- **Kendin Test Et:** Kod yazdıktan sonra kendin test et: yerel sunucuyu aç, tarayıcı konsolunda JavaScript hatası var mı kontrol et. Buton/işlev gerçekten çalışıyor mu doğrula.
- **Ham Veri Loglama:** Bir veri akışı kurarken (özellikle AI'dan gelen veriyi işlerken), her adımda ham veriyi logla ki verinin nerede koptuğu görülebilsin.

---

## AI ile Belge Okuma (Fatura, Menü vb.)
- **Net Prompt:** Prompt net olsun: istenen alanları tek tek say, çıktı formatını dayat (sadece JSON, başka açıklama yok).
- **Türkçe Sayı Formatı:** Türkçe sayı formatını dikkate al: `"40,00"` = 40 ve `"2.000,00"` = 2000.
- **Alan Adı Esnekliği:** Zincirin her halkasında (AI çıktısı → ara işlem → backend) alan adları tutarlı olmalı. Backend, aynı verinin birden fazla olası alan adını kabul edecek şekilde esnek yazılmalı.

---

## Arayüz
- **Performans:** Günlük kullanılan ekranlar sade ve hızlı olsun; ağır özellikler (analiz/grafikler gibi) ayrı sekmede dursun.
- **Mobil Uyumluluk (Responsive):** Her değişiklik mobilde de düzgün çalışsın. Hiçbir sayfa bütün olarak sağa-sola kaymasın; sadece geniş tablolar kendi içinde kaysın.
- **Doğrudan Olay Bağlama:** Butonlara/işlevlere olay bağlarken gerçekten bağlandığından emin ol; basit, doğrudan bağlama tercih et (`onclick` gibi doğrudan çağrılar).

---

## Güvenlik
- **Korumalı İşlemler:** Tehlikeli ve geri alınamaz işlemler (veri sıfırlama gibi) korunmalı: gizli konum + şifre kontrolü + onay penceresi + bildirim.
- **Şifre Yönetimi:** Şifre kontrolü backend'de `process.env` üzerinden yapılmalı, koda gömülmemeli.

---

## Çalışma Tarzı
- **Bütünsel Yaklaşım:** İlişkili değişiklikleri tek seferde, bütün olarak yap.
- **Mevcut Yapıyı Koruma:** Var olan, çalışan bir şeyi bozma; değişiklik yaparken diğer özelliklerin çalışmaya devam ettiğinden emin ol.
