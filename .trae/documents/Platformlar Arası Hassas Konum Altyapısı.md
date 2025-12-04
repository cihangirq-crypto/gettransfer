## Hedef
- Masaüstü ve mobil tüm tarayıcılarda mümkün olan en hassas (Wi‑Fi/GPS tabanlı) konumu almak
- Yanlış/uzak konumların önüne geçmek; IP konumunu yalnızca son çare olarak kullanmak
- Kullanıcıya konum doğruluğunu (± metre) göstermek ve kalibrasyon akışı sağlamak

## Teknik Yaklaşım
- **HTTPS zorunluluğu**: Tarayıcıların hassas konum sağlayabilmesi için siteyi güvenli bağlamda çalıştır.
  - Geliştirme: Vite `server.https` (self‑signed sertifika) ile `https://<ip>:5173`
  - Üretim: Barındırma HTTPS; HTTP → HTTPS yönlendirmesi
- **HTML5 Geolocation (birincil yöntem)**
  - `getCurrentPosition` ve kısa süreli `watchPosition` ile çoklu ölçüm al, `accuracy` değeri en düşük olanı seç
  - Seçenekler: `enableHighAccuracy: true`, `timeout: 30000`, `maximumAge: 0`
  - `navigator.permissions.query({ name: 'geolocation' })` ile izin durumu; gerekirse kullanıcıyı tarayıcı ayarına yönlendir
- **Wi‑Fi konum fallback (ikincil yöntem)**
  - Güvenli bağlam yoksa veya HTML5 ölçüm başarısızsa, Mozilla Location Service (MLS) `geolocate?key=test` ile dene
  - Başarıysa kullan; değilse uyarı göster ve bir sonraki adıma geç
- **IP konum fallback (son çare)**
  - Sadece MLS başarısızsa IP tabanlı konum (yaklaşık olarak işaretle ve kullanıcıya açıklama göster)
- **UI/UX geliştirmeleri**
  - ± metre cinsinden doğruluk, ölçüm zamanı ve “Konumu kalibre et” butonu
  - İzin reddinde açıklayıcı yönerge (tarayıcı ve OS konum ayarları)
  - Daha iyi ölçüm geldiğinde haritayı yumuşak pan/zoom ile güncelle

## Uygulama Adımları
1) **HTTPS dev sunucusu**
- Vite konfigürasyonda `server.https` ile sertifika/key ayarla ve `--host` aktif
- HTTP’ye gelen istekleri otomatik HTTPS’e yönlendir (dev/prod)

2) **LocationDetector iyileştirme**
- İzin kontrolü ve yönlendirme: Permissions API ile
- Çoklu ölçüm toplayıcı: 10–15 sn boyunca ölçümleri kaydet, `accuracy` en düşük olanı seç
- `watchPosition` yönetimi: eşik (`accuracy < 50m`) yakalandığında sonlandır
- Doğruluk ve zaman bilgisini UI’da göster; kalibrasyon butonu ölçümü yeniden tetikler

3) **MLS fallback entegrasyonu**
- `https://location.services.mozilla.com/v1/geolocate?key=test` çağrısı
- Zaman aşımı ve hata yönetimi; başarıysa konumla devam et

4) **IP fallback (en sona)**
- `ipapi.co/json` gibi servislerle ~yaklaşık konum
- UI’da “yaklaşık” uyarısı; kullanıcıya HTTPS’e geçme ve izin verme önerisi

5) **Testler**
- E2E (Playwright):
  - HTTPS altında hassas konum: geolocation mock ile ± değerlerin UI’da görünmesi
  - İzin reddi → MLS fallback → IP fallback akışları
- Birim: ölçüm seçici (best‑of) fonksiyonu ve `accuracy` kıyaslaması

## Kabul Kriterleri
- HTTPS altında masaüstü konumu neredeyim.net doğruluğuna yakın (tipik 50–150m)
- Mobilde GPS ile <20m doğruluk
- UI’da doğruluk gösterimi ve kalibrasyon akışı sorunsuz
- IP konumu sadece son çare; kullanıcıya açıkça “yaklaşık” olarak belirtilir

## Notlar
- Daha da yüksek doğruluk için Google Geolocation API entegrasyonu opsiyonel (API anahtarı ve ücretlendirme gerekir). İsterseniz ekleyebilirim; ancak HTML5 + HTTPS çoğu senaryoda yeterince hassastır.
