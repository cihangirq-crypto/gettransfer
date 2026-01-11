# Ana Sayfa Konum ve Harita Görüntüleme Düzeltme Planı

## Tespit Edilen Sorun
Ana sayfada (Müşteri ekranı) konum izni verilmediğinde veya GPS hatası alındığında, harita bileşeni hiç yüklenmiyor ve kullanıcı manuel konum seçimi yapamıyor. Sistem sadece "Konum Alınıyor" veya hata ekranında takılı kalıyor.

## Çözüm Adımları

### 1. Varsayılan Konum (Fallback) Mekanizması
- **Dosya:** `src/components/ImmediateRideRequest.tsx`
- **İşlem:** `getCurrentLocation` fonksiyonunda hata alındığında (GPS kapalı veya izin reddedildi), `currentLocation` state'ini varsayılan bir konuma (Ankara Merkez: 39.9334, 32.8597) ayarlayacağım.
- **Amaç:** Haritanın her koşulda yüklenmesini sağlamak.

### 2. Kullanıcı Bilgilendirmesi
- **Dosya:** `src/components/ImmediateRideRequest.tsx`
- **İşlem:** GPS başarısız olduğunda gösterilen hata mesajını güncelleyeceğim: *"Otomatik konum alınamadı. Lütfen harita üzerinden konumunuzu seçin."*

### 3. Harita Etkileşimi
- Harita yüklendiğinde kullanıcının pin'i sürükleyerek veya tıklayarak konumunu manuel düzeltebilmesi zaten mevcut (`onMapClick`), ancak harita görünmediği için kullanılamıyordu. Harita görünür hale gelince bu özellik de aktif olacak.

Bu değişiklikler sonucunda:
1.  Ana sayfaya girdiğinizde konum izni vermeseniz bile harita açılacak.
2.  Varsayılan olarak Ankara (veya belirlediğimiz merkez) görünecek.
3.  Siz haritaya tıklayarak "Ben buradayım" diyebileceksiniz.
4.  "Konum doğru değil" şikayeti, manuel düzeltme imkanı sayesinde çözülecek.