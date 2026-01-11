# Sürücü ve Müşteri Deneyimi İyileştirme Planı

Bu plan, sürücü konum takibi, rota oluşturma güvenilirliği ve sürücü-müşteri iletişimini iyileştirmeyi hedefler.

## 1. Konum Doğruluğu ve Optimizasyonu (Sürücü Tarafı)
**Sorun:** `watchPosition` ham veriyi direkt gönderiyor, bu da "zıplayan" konumlara ve gereksiz sunucu trafiğine yol açıyor.
**Çözüm:**
*   **Akıllı Filtreleme:** `DriverDashboard.tsx` içindeki GPS takibine bir "mesafe eşiği" (örn. 10 metre) ve "zaman eşiği" (örn. 5 saniye) ekleyerek gereksiz güncellemeleri önle.
*   **Yüksek Doğruluk Ayarı:** `enableHighAccuracy: true` korunacak, ancak hata durumunda (GPS sinyali yoksa) kullanıcıya net bir uyarı gösterilecek.

## 2. Rota ve Harita İyileştirmeleri (Müşteri Tarafı)
**Sorun:** `TrackingPage.tsx` sürücü konumunu sadece 15 saniyede bir `fetch` ile çekiyor. Bu da haritada sürücünün "ışınlanmasına" neden oluyor. Ayrıca OSRM servisi bazen yanıt vermiyor.
**Çözüm:**
*   **Gerçek Zamanlı Socket Entegrasyonu:** Müşteri tarafında `setInterval` (polling) yerine `socket.on('driver:update')` dinleyicisi eklenerek sürücü konumu anlık ve akıcı hale getirilecek.
*   **Rota Yedekleme Mekanizması:** OSRM servisi yanıt vermezse, haritada otomatik olarak "Kuş Uçuşu" (düz çizgi) moduna geçişi yumuşatan ve kullanıcıya "Rota hesaplanıyor..." yerine "Sürücü konumu güncelleniyor" bilgisini veren bir yapı kurulacak.

## 3. İletişim ve Bilgilendirme
**Sorun:** Mevcut chat sistemi simülasyon (fake) ve otomatik bilgilendirme yok.
**Çözüm:**
*   **Gerçek Zamanlı Chat Altyapısı:** `socket.io` üzerinden basit bir mesajlaşma protokolü (istemci tarafında) hazırlanacak.
*   **Akıllı Bildirimler:**
    *   Sürücü, müşteriye 500 metre yaklaştığında müşteriye otomatik "Sürücü yaklaşıyor" bildirimi.
    *   Sürücü "Geldim" dediğinde müşteriye net bir modal/uyarı.
*   **Durum Göstergeleri:** Bağlantı koptuğunda (Offline durumu) hem sürücüye hem müşteriye "İnternet bağlantısı bekleniyor" uyarısı eklenecek.

## Uygulama Adımları
1.  `DriverDashboard.tsx`: `watchPosition` mantığını optimize et (Throttle + Distance Filter).
2.  `TrackingPage.tsx`: Polling'i kaldır/azalt, yerine Socket dinleyicisi ekle.
3.  `TrackingPage.tsx`: OSRM hata yakalama (try-catch) bloğunu güçlendir.
4.  `DriverDashboard.tsx` ve `TrackingPage.tsx`: Otomatik mesafe kontrolü ve bildirimleri ekle.
