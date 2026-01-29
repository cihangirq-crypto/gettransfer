## Durum Analizi
- Projede konum 3 ana yerde üretiliyor/işleniyor: tarayıcı geolocation + manuel kalibrasyon [LocationDetector.tsx](file:///c:/projeler/gettransfer/src/components/LocationDetector.tsx), Leaflet harita [OpenStreetMap.tsx](file:///c:/projeler/gettransfer/src/components/OpenStreetMap.tsx), sürücü/rezervasyon store akışları [bookingStore.ts](file:///c:/projeler/gettransfer/src/stores/bookingStore.ts).
- “Bazen herkes Antalya’da görünüyor” şikayeti, kodda Antalya sabit merkezinin (36.8969, 30.7133) hem UI kalibrasyonunda hem backend varsayılanlarında bulunmasıyla uyumlu.

## Muhtemel Kök Nedenler (Antalya’ya Düşme Şartları)
- **Konum izni yok / güvensiz bağlam (http) / GPS başarısız**: LocationDetector içinde IP fallback yaklaşık konum bulsa bile, `propagate(loc, 1000, 'geolocation')` çağrısı doğruluk eşiği nedeniyle lokasyonu “reddediyor”; kullanıcı manuel konuma basınca harita Antalya merkezinden açılıyor [LocationDetector.tsx](file:///c:/projeler/gettransfer/src/components/LocationDetector.tsx#L43-L80) ve [LocationDetector.tsx](file:///c:/projeler/gettransfer/src/components/LocationDetector.tsx#L256-L263).
- **Supabase erişim hatası / backend fallback**: Sürücü listesi veya aday sürücü havuzu Supabase’den gelmezse backend fallback sürücüleri Antalya koordinatlarıyla dönebiliyor (örn. drv_fatih/drv_vedat) [drivers.ts](file:///c:/projeler/gettransfer/backend/routes/drivers.ts) ve store bunu haritada gösteriyor [bookingStore.ts](file:///c:/projeler/gettransfer/src/stores/bookingStore.ts#L257-L294).
- **Eski pendingBooking etkisi**: `localStorage.pendingBooking` içinde kayıtlı pickup/dropoff varsa kullanıcı fark etmeden eski konum yüklenebilir [ImmediateRideRequest.tsx](file:///c:/projeler/gettransfer/src/components/ImmediateRideRequest.tsx#L254-L272).
- **Dropoff yokken arama**: Konum bulunur bulunmaz `searchDrivers` tetikleniyor ve dropoff yoksa (0,0) gönderiliyor; bazı akışları “tuhaf” hale getirebilir [ImmediateRideRequest.tsx](file:///c:/projeler/gettransfer/src/components/ImmediateRideRequest.tsx#L192-L201).
- **Harita merkezleme kontrolü hatalı**: Leaflet panTo koşulu `center.lat && center.lng` ile yazılmış; 0 değerlerinde/kenar durumlarda merkezleme çalışmaz [OpenStreetMap.tsx](file:///c:/projeler/gettransfer/src/components/OpenStreetMap.tsx#L46-L62).

## GetTransfer-Benzeri Beklenen Davranış (Hedef)
- Müşteri: Konum izni vermezse net bir ekran akışı: (1) izin iste → (2) neden gerekli → (3) “Haritadan seç” opsiyonu; harita default olarak son bilinen veya kullanıcıya en yakın/son seçtiği lokasyona açılır.
- Şoför: Uygulama açılınca “online/offline” durumu ve canlı konum güncellemesi; konum yoksa sürücü “online” olamaz (konum seç/izin ver zorunlu).
- Sistem: Varsayılan şehir sabitleri tek yerde tanımlı; hiçbir akış “sessizce” Antalya/Ankara’ya atlamaz; her fallback kullanıcıya görünür şekilde açıklanır.

## Düzenleme Listesi (Önceliklendirilmiş)
- **P0 (konum sapmasını kes, düşük risk)**
  - LocationDetector IP fallback/kalibrasyon akışını düzelt: IP konumu “geolocation” gibi filtreleme, kalibrasyon haritasının her zaman açılmasını sağlayacak şekilde ele almak.
  - Manual konum seçimini Antalya’ya sabitlemek yerine “son bilinen konum / IP konumu / daha önce seçilen konum” ile açmak.
  - ImmediateRideRequest: dropoff seçilmeden `searchDrivers` çağrısını kaldırmak; sadece `refreshApprovedDriversNear(currentLocation)` ile yakın sürücü gösterip gerçek aramayı dropoff sonrası yapmak.
  - OpenStreetMap: `center.lat && center.lng` kontrolünü sayısal kontrol ile değiştirmek.
  - pendingBooking için TTL/temizleme (örn. 30 dk) eklemek.
- **P1 (doğruluk, tutarlılık, UX)**
  - Tek bir `DEFAULT_CENTER` / `GeoDefaults` yaklaşımıyla Antalya/Ankara gibi fallback’leri tek merkezden yönetmek.
  - bookingStore: trackingLocation sonradan set edilse bile polling’in başlamasını sağlamak.
  - Konum doğruluğunu (±m) kullanıcıya daha net göstermek; düşük doğrulukta “haritadan düzelt” CTA’sını öne almak.
- **P2 (ürün kalitesi ve ölçek)**
  - Sürücü konum güncellemeleri için “minimum güncelleme aralığı / minimum hareket eşiği” ve “son güncelleme zamanı” kuralı.
  - Backend’de “lokasyon yoksa sürücüyü available yapmama” ve “lokasyonun kaynağı/accuracy” alanlarını opsiyonel olarak taşımak.
  - Harita UX: marker kümleme (çok sürücü), rota çizimi optimizasyonu, error states.

## Doğrulama ve Test Planı
- Tarayıcı senaryoları: (1) izin granted (2) denied (3) insecure http (4) düşük doğruluk (5) offline/slow network.
- Veri senaryoları: Supabase ok (gerçek sürücüler) vs Supabase fail (fallback) → UI’de açık uyarı ve yanlış şehir göstermeme.
- E2E / smoke test: “konum izni reddedildi → haritadan seç → doğru koordinat store’a düşüyor → sürücü listesi buna göre sıralanıyor”.

## Telemetri (Hangi şartta oluyor sorusunu netleştirmek için)
- Frontend’de: konum kaynağı (gps/ip/manual), accuracy, secureContext, permission state, seçilen konumun önce/sonra değerleri (PII’siz).
- Backend’de: drivers/list ve drivers/request Supabase kullanıldı mı/fallback’e düştü mü.

Onay verirseniz, P0 maddelerini önce uygulayıp (en az riskle) “Antalya’ya düşme” şikayetini büyük ölçüde kesmeye odaklanacağım; sonra P1/P2’ye geçeriz.