# 🚗 GetTransfer

Modern bir transfer ve sürücü takip uygulaması. React + Vite + Express + Supabase ile geliştirilmiştir.

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

---

## 📑 İçindekiler

- [Özellikler](#-özellikler)
- [Hızlı Başlangıç](#-hızlı-başlangıç)
- [Kurulum](#-kurulum)
- [Kullanım](#-kullanım)
- [Proje Yapısı](#-proje-yapısı)
- [API Endpoints](#-api-endpoints)
- [Deploy](#-deploy)
- [Test Kullanıcıları](#-test-kullanıcıları)
- [Katkıda Bulunma](#-katkıda-bulunma)

---

## 🚀 Özellikler

- **Anlık Transfer**: Araç çağırma ve sürücü takibi
- **Gerçek Zamanlı Konum**: OpenStreetMap ile canlı harita
- **Çoklu Rol**: Müşteri, Sürücü ve Admin panelleri
- **SMS Doğrulama**: Twilio Verify entegrasyonu
- **Ödeme**: Stripe ile online ödeme
- **Belge Yönetimi**: Sürücü belge yükleme ve onay sistemi

---

## ⚡ Hızlı Başlangıç

```bash
# Repoyu klonla
git clone https://github.com/cihangirq-crypto/gettransfer.git
cd gettransfer

# Bağımlılıkları yükle
npm install

# Geliştirme sunucusunu başlat
npm run dev
```

Tarayıcıda aç: `http://localhost:5173`

---

## 🔧 Kurulum

### Gereksinimler

- Node.js 18+
- npm veya bun
- Supabase hesabı (ücretsiz)
- Twilio hesabı (SMS için, opsiyonel)

### Adım Adım Kurulum

#### 1. Environment Variables

`.env` dosyası oluştur:

```env
# Supabase (Gerekli)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Twilio (Opsiyonel - SMS için)
TWILIO_ACCOUNT_SID=your-account-sid
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_VERIFY_SERVICE_SID=your-verify-service-sid

# Stripe (Opsiyonel - Ödeme için)
STRIPE_SECRET_KEY=your-stripe-key
```

#### 2. Veritabanı Kurulumu

Supabase SQL Editor'de `supabase/schema.sql` dosyasını çalıştır.

#### 3. Bağımlılıkları Yükle

```bash
npm install
```

#### 4. Geliştirme Sunucusunu Başlat

```bash
npm run dev
```

---

## 💻 Kullanım

### Komutlar

| Komut | Açıklama |
|-------|----------|
| `npm run dev` | Geliştirme sunucusu (frontend + backend) |
| `npm run build` | Production build |
| `npm run preview` | Build önizleme |
| `npm run lint` | Kod kalitesi kontrolü |

### Erişim Adresleri

| Servis | URL |
|--------|-----|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:3005 |

---

## 📁 Proje Yapısı

```
gettransfer/
├── src/                    # Frontend kaynak kodları
│   ├── components/         # React bileşenleri
│   ├── pages/              # Sayfa bileşenleri
│   │   ├── admin/          # Admin paneli
│   │   ├── driver/         # Sürücü paneli
│   │   ├── customer/       # Müşteri sayfaları
│   │   └── auth/           # Kimlik doğrulama
│   ├── stores/             # Zustand state yönetimi
│   ├── types/              # TypeScript tipleri
│   └── utils/              # Yardımcı fonksiyonlar
│
├── backend/                # Backend API
│   ├── routes/             # API route'ları
│   └── services/           # İş mantığı
│
├── api/                    # Vercel serverless functions
│   └── index.ts            # Ana API handler
│
├── supabase/               # Veritabanı şeması
│   └── schema.sql          # SQL şeması
│
├── public/                 # Statik dosyalar
├── scripts/                # Yardımcı scriptler
│
├── package.json            # Proje bağımlılıkları
├── vite.config.ts          # Vite yapılandırması
├── vercel.json             # Vercel yapılandırması
└── tsconfig.json           # TypeScript yapılandırması
```

---

## 🔌 API Endpoints

### Kimlik Doğrulama
- `POST /api/auth/login` - Giriş
- `POST /api/auth/register/customer` - Müşteri kaydı
- `POST /api/auth/register/driver` - Sürücü kaydı

### Sürücüler
- `POST /api/drivers/apply` - Sürücü başvurusu
- `POST /api/drivers/auth` - Sürücü girişi
- `GET /api/drivers/:id` - Sürücü detayı
- `POST /api/drivers/location` - Konum güncelleme

### Rezervasyonlar
- `POST /api/bookings/create` - Rezervasyon oluştur
- `GET /api/bookings/:id` - Rezervasyon detayı
- `PUT /api/bookings/:id/status` - Durum güncelle

### Admin
- `GET /api/drivers/pending` - Bekleyen sürücüler
- `POST /api/drivers/approve` - Sürücü onayla
- `POST /api/drivers/reject` - Sürücü reddet

---

## 🚀 Deploy

### Vercel'a Deploy

#### Yöntem 1: GitHub Actions (Otomatik)

1. GitHub repository'sine şu secret'ları ekle:
   - `VERCEL_TOKEN`
   - `VERCEL_ORG_ID`: `team_yHUUI3ESg2rXfdV2V7JfM7zn`
   - `VERCEL_PROJECT_ID`: `prj_nmgGq9bUyhqcgwpWDA4oHwPcR679`

2. `main` branch'ine push yap, otomatik deploy olur.

#### Yöntem 2: CLI ile Manuel Deploy

```bash
# Build al
npm run build

# Vercel'a deploy et
VERCEL_PROJECT_ID=prj_nmgGq9bUyhqcgwpWDA4oHwPcR679 \
VERCEL_ORG_ID=team_yHUUI3ESg2rXfdV2V7JfM7zn \
npx vercel --token "YOUR_TOKEN" --prod --yes
```

### Vercel Ayarları

| Ayar | Değer |
|------|-------|
| Framework | Diğer (Vite) |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Install Command | `npm install` |

---

## 👤 Test Kullanıcıları

### Sürücü Girişi

| E-posta | Şifre | Ad | Araç |
|---------|-------|-----|------|
| fatih@test.com | 123456 | Fatih Yılmaz | Toyota Corolla (Sedan) |
| vedat@test.com | 123456 | Vedat Demir | Mercedes E-Class (Luxury) |

### Admin Girişi

- Henüz admin paneli şifresiz erişilebilir (geliştirme modu)

---

## 🤝 Katkıda Bulunma

1. Bu repoyu fork'layın
2. Feature branch oluşturun (`git checkout -b feature/yeni-ozellik`)
3. Değişikliklerinizi commit'leyin (`git commit -m 'Yeni özellik eklendi'`)
4. Branch'i push'layın (`git push origin feature/yeni-ozellik`)
5. Pull Request açın

---

## 📝 Notlar

### Önemli Dosyalar

- `vercel.json` - Vercel yapılandırması
- `vite.config.ts` - Vite yapılandırması
- `supabase/schema.sql` - Veritabanı şeması

### Güvenlik

- API key'ler asla repo'ya commit edilmez
- `.env` dosyası `.gitignore`'da
- Production'da tüm secret'lar Vercel Environment Variables'da

---

## 📄 Lisans

MIT License - Detaylar için [LICENSE](LICENSE) dosyasına bakın.

---

## 📞 İletişim

Sorularınız için GitHub Issues kullanabilirsiniz.
