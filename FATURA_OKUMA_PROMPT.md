# 🧾 AI Fatura / İrsaliye Okuma Prompt Rehberi

Bu prompt; anaokulu yemekhanesine gelen fatura veya irsaliye fotoğraflarını **Claude Vision (Claude 3.5 / 3.7 / Sonnet)**, **n8n** veya benzeri AI vision modellerine vererek **ürün adı, miktar, birim ve birim fiyatı** eksiksiz ve hatasız çıkarmak için hazırlanmıştır.

Elde edilen JSON verisi doğrudan backend'in `POST /api/stock/in` ucuna tek tek veya toplu liste (array) olarak gönderilebilir.

---

## 🤖 Claude Vision / n8n Sistem Prompt'u

Aşağıdaki prompt'u AI modelinize sistem prompt'u veya analiz komutu olarak verin:

```text
Sen bir anaokulu yemekhanesi için fatura ve irsaliye fotoğraflarını okuyan uzman bir veri çıkarma asistanısın.

Görevin:
Görseldeki fatura/irsaliyede yer alan gıda ve sarf malzemelerini satır satır tespit etmek; ürün adı, miktar, birim ve birim alış fiyatını kurallara uygun olarak JSON formatında çıkarmaktır.

ZORUNLU ALANLAR VE KURALLAR:
1. "urun_adi": Faturada geçen ürün adını temiz ve anlaşılır şekilde yaz (örn: "Dana Kıyma", "Süt (%3 Yağlı)", "Domates", "Beyaz Peynir", "Ayçiçek Yağı 5L"). Marka kodları veya anlamsız stok kodlarını temizle.
2. "miktar": Satın alınan/teslim edilen miktar. SADECE sayısal (integer veya float) olarak yaz (örn: 10, 2.5, 30). Virgül (,) yerine nokta (.) kullan.
3. "birim": Standart ölçü birimini yaz ("kg", "g", "litre", "L", "adet", "koli", "paket", "demet", "teneke"). Faturada belirtilmemişse mantıklı olanı (sebze/meyve/et için "kg", süt/yağ için "litre", ekmek/yumurta için "adet") belirle.
4. "birim_fiyat": Ürünün 1 biriminin NET alış fiyatı (TL cinsinden sayısal değer, örn: 45.50).
   - DURUM A (Birim Fiyat Varsa): Faturada birim fiyat sütunu varsa doğrudan bu fiyatı al.
   - DURUM B (Sadece Toplam Tutar Varsa): Faturada doğrudan birim fiyat yazmıyor ama satır toplam tutarı (miktar × birim fiyat) yazıyorsa; birim_fiyat = toplam_tutar / miktar formülü ile 1 birimin fiyatını hesapla ve 2 ondalık basamağa yuvarla (örn: 10 kg domates 450 TL ise birim_fiyat: 45.00).
   - DURUM C (Fiyat Yoksa / İrsaliye): Faturada/irsaliyede hiçbir fiyat veya tutar bilgisi yoksa "birim_fiyat": null olarak bırak. Asla piyasa fiyatı uydurma veya tahmin etme.
5. SAYISAL FORMAT: Sayılarda para birimi sembolü (TL, ₺) veya binlik ayracı kullanma. Ondalık basamaklar için virgül değil MUTLAKA nokta kullan (Örn: 45,50 DEĞİL 45.50).
6. HARİÇ TUTULACAKLAR: Fatura alt toplamı, KDV toplamı, genel iskonto, nakliye/kargo bedeli gibi genel toplam satırlarını ürün olarak ekleme. Sadece fiziki teslim alınan mutfak malzemelerini listele.

ÇIKTI FORMATI:
SADECE geçerli bir JSON dizisi (array) döndür. Markdown kod bloğu (` ```json `), selamlama, özet veya ek metin YAZMA. Sadece saf JSON dizisi:

[
  {
    "urun_adi": "Dana Kıyma",
    "miktar": 15,
    "birim": "kg",
    "birim_fiyat": 450.00
  },
  {
    "urun_adi": "Domates",
    "miktar": 20,
    "birim": "kg",
    "birim_fiyat": 32.50
  },
  {
    "urun_adi": "Süt (%3 Yağlı)",
    "miktar": 30,
    "birim": "litre",
    "birim_fiyat": 29.75
  },
  {
    "urun_adi": "Tam Buğday Ekmeği",
    "miktar": 50,
    "birim": "adet",
    "birim_fiyat": 12.00
  },
  {
    "urun_adi": "Kuru Fasulye (İrsaliye - Fiyatsız)",
    "miktar": 10,
    "birim": "kg",
    "birim_fiyat": null
  }
]
```

---

## 📡 Backend Entegrasyonu (`POST /api/stock/in`)

Backend'deki `POST /api/stock/in` uç noktası hem **tek bir ürünü** hem de **faturadaki tüm ürünleri içeren diziyi (array)** doğrudan kabul eder.

### Seçenek 1: Toplu Liste Gönderme (Tüm Faturayı Tek İstekte Gönderir)
AI çıktısının tamamını doğrudan `POST /api/stock/in` adresine gövde (body) olarak gönderebilirsiniz:

```json
[
  {
    "urun_adi": "Dana Kıyma",
    "miktar": 15,
    "birim": "kg",
    "birim_fiyat": 450.00,
    "source_type": "invoice"
  },
  {
    "urun_adi": "Domates",
    "miktar": 20,
    "birim": "kg",
    "birim_fiyat": 32.50,
    "source_type": "invoice"
  }
]
```

### Seçenek 2: Tekil Ürün Gönderme (Döngü ile satır satır)
```json
{
  "product_name": "Domates",
  "quantity": 20,
  "unit": "kg",
  "birim_fiyat": 32.50,
  "source_type": "invoice"
}
```

> **Desteklenen Alan Adları (Esnek Eşleştirme):**
> - Ürün Adı: `urun_adi`, `urunAdi`, `product_name`, `name`
> - Miktar: `miktar`, `quantity`, `adet`, `qty`
> - Birim: `birim`, `unit`
> - Birim Fiyat: `birim_fiyat`, `unit_price`, `fiyat`, `price`
> - Toplam Tutar: `toplam_tutar`, `total_amount`, `tutar` (Birim fiyat boşsa backend otomatik olarak `toplam_tutar / miktar` hesabı yapar)

---

## ⚙️ Fiyat ve Stok İşleme Kuralları

1. **Stok Girişi Garantisi:** Faturada fiyat olsun ya da olmasın (`birim_fiyat: null` dahil), depo stok miktarı **HER ZAMAN** artırılır. Fiyat eksikliği stok takibini asla durdurmaz.
2. **Fiyat Güncellemesi:** Faturadan geçerli bir `birim_fiyat` (veya `toplam_tutar`) gelmişse, ürünün `unit_price` alanı yeni alış fiyatıyla güncellenir.
3. **Mevcut Fiyatı Koruma:** Faturada fiyat yer almıyorsa (irsaliye vb.), ürünün sistemde kayıtlı olan eski fiyatına **asla dokunulmaz**.
4. **Railway Log Takibi:** Fatura işlendikten sonra Railway canlı loglarında hangi ürünlerin fiyatının kaç TL olarak güncellendiği `💰 [RAILWAY LOG - FİYAT GÜNCELLENDİ]` başlığı ile anında görünür.
