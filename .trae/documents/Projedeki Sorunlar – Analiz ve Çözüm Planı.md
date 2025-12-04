## Ana Sorun Alanları
- Konum alma doğruluğu: HTTP altında hassas konum kapalı, IP fallback yaklaşık kalıyor
- Konum alma mantığı duplikasyon ve tutarsız varsayılanlar
- Korunan rota yönlendirmesi: Giriş yapılmadan `/select-driver` yönlendirme “ekran kapanıyor” hissi doğurabilir
- Adres → koordinat mock: Rastgele koordinatlar fiyat/mesafe hesaplarını hatalı yapıyor
- Harita/ikon kaynağı: Leaflet ikonları CDN’den 1.7.1 sürüm URL ile, projede 1.9.4
- Performans: Bundle büyük; kod bölme eksik
- Güvenlik/bağımlılıklar: IP/MLS çağrıları; üretimde anahtar/limit yönetimi

## Kod Bazı Bulguları
- `LocationDetector` IP fallback var, MLS yok; HTML5 seçenekleri iyileştirilmiş, ancak accuracy best‑pick yok (kısmen eklendi): src/components/LocationDetector.tsx:62–66, 86–107, 119–126
- `ImmediateRideRequest` içinde ayrı bir `getCurrentLocation` daha var ve fallback mesajları farklı: src/components/ImmediateRideRequest.tsx:37–70
- Hata halinde varsayılan konum **Antalya** (36.8969, 30.7133): src/components/ImmediateRideRequest.tsx:195–200; `LocationDetector` tarafında **İstanbul** kullanılıyor
- Navigasyon koruması: `/select-driver` ProtectedRoute altında; giriş yoksa login’e yönlendirir: src/App.tsx:28–33
- Adres geocoding mock ve rastgele koordinatlar: src/components/ImmediateRideRequest.tsx:101–118
- Harita ikonları CDN: src/components/OpenStreetMap.tsx:6–12

## Önerilen Çözümler
1) Konum alma altyapısı
- HTTPS dev/prod zorunlu (Vite `server.https`), host yayınlama (mobil test)
- HTML5 Geolocation: `enableHighAccuracy`, `timeout: 30000`, `maximumAge: 0`
- Çoklu ölçüm ve accuracy en iyi seçimi; `watchPosition` kısa süreli rafine, `accuracy < 50m` eşiği
- Wi‑Fi fallback: Mozilla Location Service (`geolocate?key=test`)
- IP fallback: yalnızca son çare; “yaklaşık konum” olarak işaretle
- UI’da doğruluk ve kalibrasyon

2) Mantık birleştirme ve tutarlılık
- `ImmediateRideRequest` içindeki `getCurrentLocation`’ı kaldır; tüm konum alma `LocationDetector` üzerinden olsun
- Varsayılan konumu tek bir yerde ve tek bir değerde tut (örn. İstanbul) ve projede tutarlı kullan

3) Rota koruması ve UX
- `/select-driver` navigasyonundan önce kullanıcı oturumunu kontrol et; yoksa “devam etmek için giriş yap” uyarısı ve login’e yönlendirme
- Navigasyon state’i korunacak şekilde login dönüşünde tekrar `/select-driver`’a yönlendir

4) Geocoding ve rota
- Mock adres yerine Nominatim (ücretsiz) ya da OSRM ile geocoding/rota, gerçek mesafe/süre

5) Harita ikonları
- Leaflet 1.9.4 ile uyumlu yerel ikon yolu kullan veya resmi paket ikonlarını import et; CDN bağımlılığını azalt

6) Performans
- Kod bölme: `/pages` ve `/components` seviyesinde lazy import; harita ve büyük bağımlılıkları ayır

## Test ve Kabul
- E2E: HTTPS altında hassas konum; izin reddi → MLS → IP fallback akışları; `/select-driver` geçişinde login uyarısı
- Birim: accuracy en iyi seçim fonksiyonu; geocoding/rota modülleri
- Kabul: Masaüstü konumu neredeyim.net’e yakın; mobilde <20m; IP yalnız son çare; login akışında ekran “kapanma” hissi kalkar

Onayınızla, bu plan doğrultusunda refaktör ve entegrasyonları uygulayıp testleri ekleyeceğim.