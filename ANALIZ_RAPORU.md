# Anaokulu yemekhane otomasyonu — inceleme raporu

Tarih: 13 Eylül 2026

**Genel görüş:** Proje, günlük öğrenci sayısını reçeteye bağlama açısından doğru bir başlangıç. Ancak mevcut haliyle stok kayıtlarının güvenilirliğini sağlayan kontroller eksik. Gerçek depo takibinin tek kaynağı olarak kullanılmadan önce aşağıdaki kritik sorunlar giderilmeli. Uygulamayı yeniden yazmak zorunlu değil; mevcut yapı üzerinde veri bütünlüğü, erişim kontrolü ve eksik personel ekranları tamamlanabilir.

**Kapsam ve sınırlar:** Sunucu, sekiz API modülü, iki arayüz kopyası, veritabanı şemaları, kurulum/örnek veri dosyaları, menü yükleme betiği ve proje özeti incelendi. Canlı Supabase/Railway ortamına bağlanılmadı; kayıt eklenmedi veya silinmedi. Tarayıcıda görsel ve uçtan uca kullanım testi yapılmadı. Canlı veritabanının bu SQL dosyalarıyla birebir aynı olduğu varsayılmamalı. Uygulama kodu değiştirilmedi.

## Mevcut kapsam

| İşlev | İncelemede görülen durum |
|---|---|
| Öğrenci sayısından günlük tüketim | API ve panel mevcut; veri bütünlüğü sorunları var |
| Ürün ekleme/silme | Mevcut; ürün güncelleme akışı yok |
| Reçete oluşturma/düzenleme | Mevcut; güncelleme/silme veri kaybına yol açabilir |
| Üç öğün ve aylık menü | Mevcut; tarih ve çoklu ay sorunları var |
| Menü görselini AI ile okuma | Mevcut; önizleme/kaydetme ayrımı olumlu |
| PDF menü | Dosya filtresi kabul ediyor, işlem 415 ile reddediyor |
| Geri bildirim ve az yenildi uyarısı | Mevcut; fiili pişirimle bağlantısı zayıf |
| Stok girişi ve güncel stok | API mevcut; panelde bu API'leri kullanan ekran yok |
| Akşam raporu | API mevcut; panel ekranı yok, hesap hataları var |
| Fatura fotoğrafından stok girişi | Depoda tam OCR akışı yok; menü görseli okuma farklı bir işlev |
| Sesli stok girişi | Kaynak türü kabul ediliyor; konuşma işleme akışı yok |
| Protein bazlı alternatif yemek önerisi | Veri alanı var, öneri motoru yok |
| Zamanlanmış rapor/bildirim | Depoda çalışan zamanlayıcı veya n8n iş akışı yok; harici kurulum doğrulanmadı |

## Öncelikli doğrulanmış bulgular

### 1. Kritik — Tüketim iptalinde stok iki kez iade ediliyor

Kaynak: `backend/routes/consumption.js:444–469`, `database/01_schema.sql:123–139`.

İptal kodu önce current_stock miktarını elle artırıyor, sonra çıkış hareketini siliyor. SQL DELETE tetikleyicisi de aynı çıkışı stoğa geri ekliyor. Örnek: 100 kg → 10 kg tüketim → 90 kg → iptal → **110 kg**. Beklenen 100 kg.

Gerçek iptal fonksiyonu, bellek içi veritabanı taklidi ve dosyadaki DELETE tetikleyicisinin aritmetiğiyle çalıştırıldı; 110 sonucu doğrulandı. Bu canlı veritabanı testi değildir. İade tek bir mekanizmadan, atomik bir işlemle yürütülmeli; hareketi silmek yerine ters hareketle iptal geçmişini korumak tercih edilmeli.

### 2. Kritik — Uygulama katmanında kimlik doğrulama/yetkilendirme yok

Kaynak: `backend/server.js:27–81`, `backend/supabase.js`.

Ürün/reçete silme, stok değiştirme, tüketim iptali, ayar değiştirme ve ücretli AI çağrısı erişim kontrolü olmadan bağlanmış. CORS tüm kaynaklara açık. Sunucu, yapılandırılırsa service-role anahtarı kullanıyor. İnternete doğrudan açık kurulumda adresi bilen kişi bu işlemleri çağırabilir. Dış ağ geçidinde koruma bulunup bulunmadığı doğrulanmadı.

Oturum, yönetici/personel rolleri ve otomasyon için ayrı kimlik bilgisi eklenmeli. AI yüklemelerinde kullanıcı başına istek sınırı olmalı. SQL kurulum rehberindeki RLS kapatma adımları ve monthly_menu üzerindeki herkese açık politika üretim için yeniden düzenlenmeli; yalnızca CORS'u kısıtlamak yeterli değildir.

### 3. Yüksek — Günlük tüketim bölünebilir ve aynı gün iki kez işlenebilir

Kaynak: `backend/routes/consumption.js:74–90,318–360`, `database/01_schema.sql`.

Önce mevcut kayıt sorgulanıyor, ardından her öğün ve stok hareketi ayrı isteklerle yazılıyor. İkinci öğünde hata olursa ilk öğün kalıyor. Tekrar denemede mevcut kayıt kontrolü kalan işlemi engelliyor. İki eşzamanlı istek mevcut kayıt kontrolünden birlikte geçebilir; şemada günlük öğün için tekillik kısıtı yok. Stok kontrolü ile düşüm arasında başka işlem stoğu tüketebilir.

Günün tamamı veritabanında tek işlem olmalı. Gün/öğün tekilliği, tekrar isteğe dayanıklılık ve eşzamanlı stok kontrolü birlikte çözülmeli. İptal akışındaki güncelleme/silme hataları da kontrol edilmeli; şu an bazı hatalara rağmen başarı yanıtı üretilebilir.

### 4. Yüksek — Taslak veya malzemesiz reçete tüketimden önce engellenmiyor

Kaynak: `backend/routes/menu.js`, `backend/routes/consumption.js:238–280`.

Menü yükleme yeni yemekleri malzemesiz taslak reçete yapıyor. Günlük tüketim is_draft bilgisini kontrol etmiyor; boş malzeme listesini kabul ederek yemek planı yazımına ilerliyor. Boş stok hareketi eklemesinin sonucuna göre sıfır tüketimli kayıt veya yarım kalmış işlem oluşabilir. Üç öğünün tam olması da zorunlu tutulmuyor; yanıt yine üç öğünün işlendiğini söyleyebiliyor.

İşleme başlamadan tüm öğünler, onaylı reçeteler ve pozitif malzeme miktarları doğrulanmalı; eksikler personele isimleriyle gösterilmeli.

### 5. Yüksek — Reçete düzenleme/silme malzemeleri kaybettirebilir

Kaynak: `backend/routes/recipes.js`, PUT ve DELETE işleyicileri.

Düzenleme önce eski malzemeleri siliyor, sonra yenilerini ekliyor. Yeni içerik geçersizse eski reçete geri yüklenmiyor. Silmede yalnızca meal_plans bağlantısı kontrol ediliyor, malzemeler silindikten sonra menü bağlantısı reçetenin silinmesini engelleyebiliyor. Sonuç: menüde kalan fakat malzemeleri silinmiş reçete.

Doğrulama yazımdan önce yapılmalı; güncelleme atomik olmalı. Silmede üst reçeteyi silip veritabanındaki CASCADE mekanizmasını kullanmak veya reçeteyi arşivlemek değerlendirilmeli.

### 6. Yüksek — Birim dönüşümü yapılmadan stok artırılıyor

Kaynak: `backend/routes/stock.js:159–267`.

Mevcut ürün kg ise gelen 500 g, miktar 500 olarak kg stoğuna yazılır. Gelen unit yalnızca yeni ürün oluşturulurken kullanılıyor. Ayrıca yaklaşık isim eşleştirmesi onaysız ürün seçiyor; farklı çeşitler aynı ürüne bağlanabilir.

Stok hareketleri standart birime çevrilmeli, uyumsuz birimler reddedilmeli. Yaklaşık eşleşmeler önizlemede personele doğrulatılmalı. Fatura/otomasyon tekrar gönderimleri için tekil belge veya istek kimliği eklenmeli; şu an tekrar giriş stoğu yeniden artırır.

### 7. Yüksek — Aylık menü SQL dosyası doğrudan çalışmıyor

Kaynak: `database/06_monthly_menu_setup.sql:49` ve devamı.

VALUES satırlarını ayırması gereken virgüller SQL yorumunun içinde kalmış. Yorumlar çıkarıldığında iki parantezli satır arasında virgül yok. Sözdizimsel sorun statik kontrolde doğrulandı; PostgreSQL üzerinde çalıştırılmadı.

Ayrıca örnek veri ve şema değişiklikleri iç içe: 02 dosyası reçete içeriklerini/menüyü siliyor, 03 dosyası recipe_id >= 8 olan tüm malzemeleri siliyor. Bu dosyaların mevcut okul verisine yeniden uygulanması veri kaybına neden olabilir. Şema geçişleri ile yalnızca test ortamına ait örnek veriler ayrılmalı.

### 8. Yüksek — Aylar birbirine karışabilir, sabit Eylül takvimi kullanılabilir

Kaynak: `backend/routes/feedback.js:207–245,407–445`, `backend/routes/consumption.js:40–44,141–184`, `backend/routes/menu.js:360`.

Aylık görünüm tüm ayları çekiyor fakat kayıtları yalnızca hafta/gün/öğün anahtarına yerleştiriyor. Başka ayın aynı haftası eskisinin üstüne yazılıyor. Beşinci hafta dördüncü haftaya sıkıştırılıyor. Geri bildirim hafta seçimi Eylül 2026 tarihlerine bağlı; tüketim fallback'i de bu tarihlere dönebiliyor.

Gerçek tarih ana kaynak olmalı. Ay/yıl filtresi, beşinci hafta ve tatil günleri desteklenmeli; menü yoksa açık hata gösterilmeli. UTC'den tarih türeten varsayılanlar İstanbul'da 00:00–02:59 arasında önceki günü verir; okul saat dilimi tek yerde uygulanmalı.

### 9. Yüksek — Raporun karşılaştırma hesabı yanlış

Kaynak: `backend/routes/reports.js:302–363`.

Geçmiş günlük ortalama hesaplandıktan sonra reçete standardı aynı değerin üstüne ekleniyor. Örneğin geçmiş ortalama 10 ve reçete ihtiyacı 10 ise karşılaştırma 20 oluyor; 10 tüketim yanlış biçimde yüzde 50 az görünüyor. Haftalık reçete sorgusu tarih aralığıyla sınırlandırılmadığından farklı haftalar da toplanabilir. Aylık menü standardı hesaba katılmıyor.

Geçmiş ortalama ve menü standardı ayrı ölçütler olmalı. Geçmiş tarih raporundaki kalan miktar da o günün kapanış stoğu değil, bugünkü current_stock değeridir; tarihsel bakiye veya açık bir güncel stok etiketi gereklidir.

### 10. Yüksek — HTML/JavaScript bağlamında güvenli olmayan veri yerleştirme

Kaynak: `backend/public/app.js:674,1322,1433–1456` ve aynı frontend kopyası.

Ürün adı inline onclick içine yerleştiriliyor; escapeHtml metin düğümünden HTML üretir, JavaScript tırnak bağlamını güvenli hale getirmez. Tek tırnak içeren sıradan bir ad bile silme düğmesini bozabilir. Menüden dönen yemek adları ve bazı hata metinleri de doğrudan innerHTML'e aktarılıyor; hazırlanmış veri tarayıcıda kod çalıştırma riski taşır. Tarayıcıda istismar testi yapılmadı.

Dinamik olayları addEventListener ile bağlamak, ad/hata metinlerini textContent ile yazmak ve gereksiz HTML yorumlamayı kaldırmak gerekir.

## Diğer eksikler ve bakım riskleri

- **Sıfır stok görünürlüğü:** Yeni ürün eklenince current_stock satırı oluşturulmuyor. Stok listesi bu tablodan başladığı için hiç stok girişi olmayan ürünler kritik listesinde görünmez. Ürünlerden başlayan birleştirme ve boş miktarı sıfır kabul etme gerekir.
- **Ayar kaydı yanıltıcı olabilir:** settings.js Supabase upsert sonucundaki error değerini kontrol etmiyor; yerel dosya yazım hatasını da yutuyor. İki kayıt da başarısız olsa başarı yanıtı verilebilir. Yaş grubu ayarı yalnızca metin gösterimini değiştiriyor; porsiyon hesabına etkisi yok.
- **Kimlik üretimi:** stock.js ve menu.js son ID + 1 yöntemini kullanıyor. Eşzamanlı kayıtlar çakışabilir. Sequence sorunu veritabanında onarılmalı.
- **Menüde öğün kaldırma:** menu/save boş öğünleri atlıyor; önceki satırı silmiyor. Önizlemede boşaltılan öğün kayıtlı kalabilir.
- **Girdi doğrulama:** parseInt/parseFloat kısmi metni kabul ediyor. Reçete PUT akışında pozitif miktar kontrolü yok. Şemada miktar/porsiyon pozitiflik kısıtları bulunmuyor; negatif malzeme tüketimi stok artırabilir. Sonlu sayı, gerçek tarih, metin uzunluğu ve izin verilen birimler kontrol edilmeli.
- **Geri bildirim güvenilirliği:** Pişirilmemiş yemek için kayıt girilebilir; aynı gün/reçete tekilliği veritabanında yok. Son beş geri bildirim, son beş gerçek pişirimle aynı şey değil. Geçmiş tarih görüntüsünde daha sonraki geri bildirimler de hesaba girebilir.
- **İzlenebilirlik:** İşlemi yapan kullanıcı, değişiklik nedeni ve iptal geçmişi tutulmuyor. Reçete sürümü ve yemek adı değişiklikleri geçmişin yorumunu etkileyebilir.
- **Ölçek:** Liste sorgularında sayfalama yok; ürün/menü/tarihçe büyüdüğünde eksik sonuç ve performans riski değerlendirilmelidir. Günlük işlemler seri ağ isteklerine bağlı.
- **Sağlık kontrolü:** /health veritabanı hazır olmasa da ok döndürüyor. Supabase istemcisinin oluşturulması gerçek bağlantı testi değil. Hazır olma kontrolü ayrı olmalı.
- **AI dayanıklılığı:** HTTPS isteğinde açık zaman aşımı/iptal yok. Dosya boyut sınırı var fakat eşzamanlı istek ve maliyet sınırı yok. Çıktıda tam tarih/ay ve içerik şeması doğrulaması eksik.
- **Dağıtım:** railway.toml komutları backend çalışma dizini gerektiriyor; kök dizinde package.json/server.js yok. Railway Root Directory ayarı doğrulanmalı. .env.example ve güncel uçtan uca kurulum rehberi yok.
- **İki arayüz kopyası:** frontend ve backend/public dosyaları şu an birebir aynı. Sunucu backend/public'i öncelikli sunuyor. Tek kopyada yapılan değişiklik görünmeyebilir; tek kaynak veya otomatik kopyalama süreci gerekir.
- **Test altyapısı:** package.json test komutu gerçek test çalıştırmıyor, bilerek hata veriyor. Depoda otomatik test/CI tanımı bulunmadı.

## İşletme açısından tamamlanması gerekenler

İlk amaç ürünün bittiğini son dakika öğrenmemek. Bunun için günlük tüketim ekranına ek olarak güncel stok, manuel stok girişi, kritik ürün listesi ve gelecek menüye göre satın alma ihtiyacı ekranları gerekli. Personel bunları API çağırmadan kullanabilmeli.

Bir sonraki aşamada fiili sayım düzeltmesi, fire/bozulma kaydı, son kullanma tarihi/parti takibi, tedarikçi-fatura geçmişi ve dışa aktarım eklenmeli. Şemada waste türü var, ancak buna yönelik kullanım akışı yok. Reçeteye göre tahmini tüketim ile fiili tüketim ayrılmalı; aynı öğrenci sayısının üç öğüne birden uygulanmasının okul uygulamasına uygunluğu teyit edilmeli.

Beslenme özellikleri geliştirilecekse protein alanının ölçüm temeli açık tanımlanmalı; kg, litre ve adet için aynı yorum kullanılamaz. Alerjen ve özel menü alanları da ürün tasarımı kapsamında değerlendirilmeli. Bu inceleme beslenme değerlerinin veya yaşa uygun gramajların sağlık açısından doğrulanmasını kapsamaz.

## Doğrulama ve önerilen sıra

Yapılan kontroller: 13 JavaScript dosyası sözdizimi kontrolünden geçti; iki arayüzün hash değerleri eşleşti; iptal fonksiyonundaki çift iade taklit veritabanıyla yeniden üretildi; aylık menü SQL ayırıcı hatası yorumlar kaldırılarak doğrulandı. .env Git'in izlediği dosyalar arasında değil; gizli değerler okunup rapora aktarılmadı. Canlı güvenlik yapılandırması, bağımlılık güvenlik açıkları, yedek/geri dönüş ve mobil/erişilebilirlik davranışı doğrulanmadı.

1. **Veri güvenilirliği:** Çift iade, atomik tüketim/iptal, reçete düzenleme/silme, taslak kontrolü ve birim dönüşümü.
2. **Erişim ve kurulum:** Oturum/roller, RLS politikaları, girdi doğrulama, HTML güvenliği, SQL kurulumu ve test verisinin ayrılması.
3. **Günlük kullanım:** Stok giriş/durum ekranları, kritik stok, gerçek takvim, doğru raporlar ve görünür hata mesajları.
4. **Operasyon:** Denetim geçmişi, yedekten dönüş denemesi, sayım/fire, satın alma ihtiyacı, tekrar güvenli fatura akışı.
5. **İleri özellikler:** Ses, AI raporu ve protein bazlı öneriler; temel kayıtlar doğru çalıştıktan sonra.

Yayın öncesi kabul senaryoları: tüketim+iptal başlangıç bakiyesine dönmeli; aynı gün iki paralel istek tek işlem üretmeli; ara aşama hatası hiçbir kısmi kayıt bırakmamalı; 500 g giriş kg stoğuna 0,5 eklemeli; malzemesiz reçete işlenmemeli; menüye bağlı reçeteyi silme girişimi malzemeleri korumalı; iki ayrı ay birbirini ezmemeli; örnek rapor hesabı elle hesapla uyuşmalı; yetkisiz kullanıcı yazma işlemi yapamamalı.
