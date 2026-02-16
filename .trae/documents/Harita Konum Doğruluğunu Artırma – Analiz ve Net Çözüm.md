## Mevcut Durum Analizi
- Harita katmanı OpenStreetMap + Leaflet ile stabil (src/components/OpenStreetMap.tsx:80–89)
- Konum tespiti `LocationDetector` içinde yapılıyor, başarısızlıkta IP fallback var (src/components/LocationDetector.tsx:20–38, 48–52, 119–124)
- İlk konumdan sonra `watchPosition` açılıyor fakat doğruluk/yaş kontrolü sınırlı (src/components/LocationDetector.tsx:86–93)
- Haritada kullanıcı konumu ve sürücüler doğru işleniyor (src/components/ImmediateRideRequest.tsx:223–240); sorun haritanın değil konum kaynağının doğruluğu

## Sorunun Kaynağı
- Tarayıcılar hassas konumu yalnızca **güvenli bağlamda (HTTPS)** verir. HTTP altında Wi‑Fi tabanlı konum engellenir → IP konumu (yaklaşık) devreye girer.
- Mevcut fallback yalnızca IP tabanlı; Wi‑Fi konum sağlayıcı (Mozilla Location Service) yok.
- `maximumAge: 60000` eski ölçümü kullanabilir; masaüstü senaryolarda doğruluk düşebilir.

## Net Çözüm – Katmanlı Konum Boru Hattı
1) **HTTPS Zorunluğu (Dev + Prod)**
- Geliştirme sunucusunu HTTPS’e geçir, ağda `https://<ip>:5173` ile eriş.
- Üretimde site her zaman HTTPS altında çalışmalı.

2) **HTML5 Geolocation İyileştirme (Birincil Yöntem)**
- İzin kontrolü: `navigator.permissions.query({ name: 'geolocation' })` ile durumu al; reddedilmişse kullanıcıyı tarayıcı ayarlarına yönlendir.
- Seçenekler: `enableHighAccuracy: true`, `timeout: 30000`, `maximumAge: 0`.
- Çoklu ölçüm: 10–15 sn içinde gelen ölçümleri topla; `accuracy` değeri en düşük olanı “en iyi ölçüm” olarak seç.
- `watchPosition` kısa süreli açılarak ölçüm rafine edilir; `accuracy < 50m` eşiği yakalanınca izlemeyi durdur.
- UI’da doğruluk (± m) ve ölçüm zamanı göster.

3) **Wi‑Fi Konum Fallback (İkincil Yöntem)**
- HTML5 başarısız veya güvenli bağlam değilse Mozilla Location Service kullan: `https://location.services.mozilla.com/v1/geolocate?key=test`.
- Başarıysa bu konumu kullan; UI’da “Wi‑Fi konumu” olarak işaretle.

4) **IP Konum Fallback (Son Çare)**
- MLS başarısızsa IP tabanlı konum (ör. `ipapi.co/json`) kullanılabilir.
- UI’da “yaklaşık konum” uyarısı ve HTTPS + izin verme önerisi gösterilir.

5) **Harita Davranışı ve UX**
- Yeni ve daha iyi ölçüm geldiğinde haritayı yumuşak pan/zoom ile güncelle (OpenStreetMap.tsx:37–44, 78–85).
- “Konumu kalibre et” butonu ile boru hattı tekrar çalıştırılır.

## Değiştirilmesi Önerilen Noktalar
- `LocationDetector`
  - `maximumAge: 0`, `timeout: 30000` ve çoklu ölçüm seçici eklensin (src/components/LocationDetector.tsx:62–66)
  - Permissions API ile izin durumu ve yönlendirme
  - MLS fallback çağrısı (güvenli bağlam yoksa veya hata)
  - IP fallback son çare (mevcut ipapi kalabilir)
  - UI’da doğruluk metrikleri ve kalibrasyon düğmesi
- Dev/prod konfigürasyonu
  - Vite HTTPS ayarı; prod’da otomatik HTTPS yönlendirmesi

## Test Planı
- E2E (Playwright):
  - HTTPS altında hassas konum → UI’da ± değer ve doğru harita merkezi
  - İzin reddi → MLS fallback → IP fallback akışları
  - “Kalibre et” düğmesi konumu iyileştirir
- Birim: “en iyi ölçüm seçici” ve accuracy eşiği mantığı

## Kabul Kriterleri
- Masaüstünde HTTPS altında konum doğruluğu neredeyim.net ile uyumlu (tipik 50–150 m)
- Mobilde GPS ile <20 m doğruluk
- IP konumu yalnızca son çare; kullanıcıya açıkça “yaklaşık” olarak gösterilir

## Opsiyonel Gelişmiş Seçenek
- Google Geolocation API entegrasyonu (API anahtarı/ücretlendirme gerektirir); daha hassas şehir içi konumlarda ek doğruluk sağlar.

Onay sonrası bu plan doğrultusunda kodu güncelleyip HTTPS dev ortamı, MLS fallback ve gelişmiş HTML5 ölçüm hattını devreye alacağım.