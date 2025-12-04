## Sorun Analizi
- Masaüstünde harita görünüyor ancak konum yanlış; bunun ana sebebi genellikle HTTPS olmaması nedeniyle tarayıcı GPS/Wi‑Fi konumunun engellenmesi ve IP tabanlı yaklaşık konuma düşülmesi.
- Referans sitede (neredeyim.net) konumun doğru görünmesi, sitenin HTTPS altında HTML5 Geolocation API’yi (Wi‑Fi tabanlı konum sağlayıcı) kullanmasından kaynaklanır.

## Çözüm Stratejisi
- **HTTPS dev sunucu**: Geliştirme ortamını HTTPS ile çalıştırıp tarayıcının hassas konum paylaşımını açmak.
- **HTML5 Geolocation iyileştirme**:
  - `navigator.permissions.query({ name: 'geolocation' })` ile izin durumunu kontrol et ve kullanıcıyı yönlendir.
  - `getCurrentPosition` için yüksek doğruluk, daha uzun `timeout`, `maximumAge: 0` ile taze ölçüm.
  - Birden fazla ölçüm denemesi yap; `accuracy` alanı daha düşük olan (daha doğru) ölçümü seç.
  - Kısa süreli `watchPosition` açarak ilk ölçüm sonrasında doğruluğu rafine et, en iyi ölçümü kullan.
- **Wi‑Fi konum fallback (MLS)**: GPS/izin hatası veya düşük doğrulukta, Mozilla Location Service (ücretsiz, test anahtarı) ile Wi‑Fi/cell tabanlı konum alma.
- **IP fallback son çare**: MLS başarısızsa IP konumu; kullanıcıya “yaklaşık” uyarısı göster.
- **UI geliştirmeleri**:
  - Konum doğruluğunu (± metre) göster.
  - “Konumu kalibre et” butonu ile yeniden ölçüm tetikle.
  - İzin reddinde tarayıcı ayarlarına hızlı erişim yönergesi.
- **Harita davranışı**: Daha iyi bir ölçüm geldiğinde haritayı yumuşak pan/zoom ile yeni konuma getir.

## Uygulama Adımları
1) **Dev sunucuyu HTTPS’e geçir**
- Vite `server.https` ile self‑signed sertifika; ağda `https://<ip>:5173` üzerinden erişim.

2) **LocationDetector iyileştirmeleri**
- İzin kontrolü ve yönlendirme.
- Çoklu ölçüm ve `accuracy` karşılaştırması, en iyi ölçümü seçme.
- `watchPosition` aç/kapat yönetimi; en iyi ölçümü sakla ve haritaya uygula.

3) **MLS fallback entegrasyonu**
- `https://location.services.mozilla.com/v1/geolocate?key=test` endpoint’i ile Wi‑Fi konumu dene; başarıysa kullan.
- Zaman aşımı ve hata yönetimi ekle.

4) **UI/UX**
- Doğruluk göstergesi ve kalibrasyon butonu.
- İzin reddi/HTTP uyarıları için açıklayıcı mesajlar.

5) **Testler**
- E2E: HTTPS altında hassas konum testi, izin reddi → MLS fallback, MLS reddi → IP fallback.
- Birim: ölçüm seçici (best‑of) ve `accuracy` mantığı.

## Kabul Kriterleri
- HTTPS altında masaüstü konumu, neredeyim.net’e yakın doğrulukta.
- İzin reddinde kullanıcı yönlendirilir; MLS ile çoğu masaüstünde doğruya yakın konum elde edilir.
- UI’de ±metre doğruluk gösterilir; kalibrasyon ile konum iyileşir.
- Harita yeni ölçüme sorunsuz uyum sağlar (pan/zoom) ve sürücüler doğru konum çevresinde listelenir.