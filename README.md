# GetTransfer

Modern React + TypeScript + Vite tabanlı bir “anlık transfer ve sürücü takibi” uygulaması. Ön yüz (Vite React) ve arka uç (Express) birlikte çalışır; harita için OpenStreetMap/Leaflet kullanılır, e2e testler Playwright ile doğrulanır.

Yeni sohbet/agent/AI ile hızlı başlamak için: [AI_START_HERE.md](file:///c:/projeler/gettransfer/AI_START_HERE.md)

## Özellikler
- Anlık araç çağırma akışı ve aday sürücü listesi
- OpenStreetMap ile canlı konum ve varış noktası gösterimi
- Basit Express tabanlı API: `auth`, `drivers`, `bookings`, `places`
- Durum yönetimi: `zustand`
- E2E testler: `@playwright/test`

## Kurulum
1. Depoyu alın ve dizine geçin
2. Bağımlılıkları yükleyin: `npm i`
3. Geliştirme modunda istemci ve sunucuyu birlikte başlatın: `npm run dev`
   - İstemci: `http://localhost:5173`
   - API: `http://localhost:3001`

Alternatif olarak önizleme sunucusu: `npm run build` ve `npm run preview` ile `http://localhost:4173` altında derlenmiş çıktıyı çalıştırabilirsiniz.

## Komutlar
- `npm run dev`: Vite istemci + Nodemon ile Express API birlikte çalıştırılır
- `npm run client:dev`: İstemciyi tek başına çalıştırır
- `npm run server:dev`: API’yi tek başına çalıştırır
- `npm run build`: Tip kontrol ve prod derleme
- `npm run preview`: Derlenmiş çıktıyı servis eder
- `npm run check`: TypeScript tip kontrolü
- `npm run lint`: ESLint denetimi
- `npm run test:e2e`: Playwright e2e testlerini çalıştırma (aşağıya bakın)

## API Uçları (Özet)
- `POST /api/auth/login`: Mock oturum açma
- `POST /api/auth/register/customer` ve `POST /api/auth/register/driver`: Mock kayıt
- `POST /api/drivers/request`: Sürücü adaylarını döndürür
- `GET /api/drivers/requests`: Bekleyen talepler
- `POST /api/bookings/create`: Rezervasyon oluşturur
- `PUT /api/bookings/:id/status`: Rezervasyon durumu günceller
- `GET /api/places/search`: OpenStreetMap üzerinden arama
- `POST /api/places/record`: Popüler arama etiketi kaydı

## Testler
E2E testler `e2e` klasöründe bulunur.

Önizleme sunucusunu başlatın:
- `npm run build`
- `npm run preview` (sunucu `http://localhost:4173`)

Sonra e2e testleri çalıştırın:
- `npx playwright test -c e2e --reporter=list`

## Geliştirme Notları
- Vite proxy ayarı ile istemci `http://localhost:3001` üzerindeki API’ye `/api` yolundan bağlanır
- Harita bileşenleri `react-leaflet` ve `leaflet` kullanır
- Kalıcı oturum için `zustand`’ın `persist` aracı kullanılır

## Dizim
- `api`: Express uygulaması ve Vercel uyumlu fonksiyonlar
- `src`: React istemci kaynakları (bileşenler, sayfalar, store’lar)
- `e2e`: Playwright testleri
- `public/dist`: Derlenmiş statik dosyalar

## Ortam Değişkenleri
Geliştirme için `.env` dosyası kullanılabilir. Üretim sırlarını depoya koymayın.

## 📚 Dokümantasyon

| Dosya | Açıklama |
|-------|----------|
| [DEPLOY_GUIDE.md](./DEPLOY_GUIDE.md) | 🚀 **Vercel Deploy Rehberi** - Sık yapılan hatalar ve çözümleri |
| [QUICK_DEPLOY.md](./QUICK_DEPLOY.md) | ⚡ Hızlı deploy kartı |
| [SECRETS_AND_SETUP.md](./docs/SECRETS_AND_SETUP.md) | Kurulum ve secret yönetimi |
| [AI_WORKSPACE_RULES.md](./docs/AI_WORKSPACE_RULES.md) | AI ile çalışma kuralları |
| [AI_START_HERE.md](./AI_START_HERE.md) | Yeni sohbet için başlangıç noktası |

### 🔴 Deploy Öncesi Mutlaka Oku!
Deploy yapmadan önce [DEPLOY_GUIDE.md](./DEPLOY_GUIDE.md) dosyasındaki hataları okuyun. Tekrarlayan hataları önlemek için oluşturulmuştur.

Kurulum ve secret yönetimi için: [SECRETS_AND_SETUP.md](./docs/SECRETS_AND_SETUP.md)

Yeni sohbet/agent/AI ile aynı şekilde devam etmek için: [AI_WORKSPACE_RULES.md](./docs/AI_WORKSPACE_RULES.md)
