## Kapsam
- Harita ve konum: OpenStreetMap görünümü, kullanıcı konum algılama, sürücü işaretleri
- Rezervasyon akışı: form doldurma, fiyat/mesafe tahmini, yönlendirme
- Gerçek zamanlı: sürücü konumlarının mock güncellenmesi
- Hata senaryoları: konum izni reddi, internet kesintisi, hedef adres boş
- Mobil uyumluluk ve performans

## Manuel Test Adımları
1) Sayfa açılışı
- `http://localhost:5173/book-ride` açılır; sayfa yüklenir ve harita konteyneri görünür
- Harita karoları yüklenir, mavi işaret kullanıcı konumunu gösterir

2) Konum izni
- Tarayıcıda konum izni verilir; kullanıcı konumu mavi işaret ile gösterilir
- İzin reddedilirse varsayılan konum (İstanbul) gösterilir ve bilgi mesajı görünür

3) Sürücü işaretleri
- Harita üzerinde yeşil işaretler görünür
- Sürücü işaretine tıklanınca popup açılır; isim, puan, müsaitlik görüntülenir

4) Varış noktası
- Formda "Varış adresi" girilir; haritada kırmızı işaret oluşur
- Adres silindiğinde kırmızı işaret kaybolur

5) Arama ve tahminler
- Yolcu sayısı ve araç tipi seçilir; tahmini fiyat/mesafe/süre güncellenir
- "Hemen çağır" ile gönderildiğinde `/select-driver` sayfasına state ile yönlenir

6) Gerçek zamanlı güncellemeler
- Harita açıkken sürücü işaretleri 3 sn aralıklarla küçük hareketler yapar
- "Güncellemeyi durdur" yapılınca hareket durur

7) Hata senaryoları
- Konum izni reddi: kullanıcıya bilgi ile fallback konum
- İnternet kesintisi: OSM karoları yüklenemez; harita grid arka planı görünür ve uygulama donmadan çalışır
- Boş/Geçersiz adres: gönderim engellenir ve hata mesajı gösterilir

8) Mobil görünüm
- 375x667 viewport: harita minimum 300px, form alanları taşmadan görünür
- Dokunmatik etkileşimlerle harita zoom/pan düzgün çalışır

## Otomasyon Planı
- Birim/Test: `vitest` + `@testing-library/react` eklenerek
  - `OpenStreetMap` bileşeni: marker render testleri, props değişimi ile re-render
  - `ImmediateRideRequest`: konum hatası fallback, form doğrulama
- E2E: `playwright` ile
  - `/book-ride` yükleme, konum izni senaryosu, sürücü popup doğrulama
  - Form doldurma ve `/select-driver` yönlendirme

## Kabul Kriterleri
- Harita ve konum tüm senaryolarda görünür ve etkileşimli
- Sürücü işaretleri ve popup içerikleri doğru
- Form doğrulama ve yönlendirme hatasız
- Mobil görünümde bozulma yok, performans kabul edilebilir

## Çalıştırma
- Manuel testler için yalnızca tarayıcıda `http://localhost:5173/book-ride`
- Otomasyon için onay sonrası gerekli test paketleri eklenecek ve senaryolar yazılacak