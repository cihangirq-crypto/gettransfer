# Katkıda Bulunma Rehberi

Bu proje açık kaynak bir transfer uygulamasıdır. Katkılarınız memnuniyetle karşılanır!

---

## 🚀 Hızlı Başlangıç

### 1. Repoyu Klonlayın

```bash
git clone https://github.com/cihangirq-crypto/gettransfer.git
cd gettransfer
```

### 2. Bağımlılıkları Yükleyin

```bash
npm install
```

### 3. Geliştirme Sunucusunu Başlatın

```bash
npm run dev
```

Tarayıcıda `http://localhost:5173` adresini açın.

---

## 🛠️ Geliştirme Akışı

### Branch Oluşturma

```bash
# Ana branch'ten yeni branch oluştur
git checkout -b feature/yeni-ozellik

# veya bugfix için
git checkout -b fix/hata-duzeltmesi
```

### Commit Mesajları

Commit mesajlarında şu formatı kullanın:

```
<tip>: <kısa açıklama>

# Örnekler:
feat: Sürücü belge yükleme eklendi
fix: Konum güncelleme hatası düzeltildi
docs: README güncellendi
style: Kod formatı düzeltildi
refactor: Auth servisi yeniden düzenlendi
test: Birim testleri eklendi
```

### Pull Request

1. Değişikliklerinizi push edin
2. GitHub'da Pull Request açın
3. Açıklama kısmında ne yaptığınızı açıklayın

---

## 📁 Proje Yapısını Anlamak

```
src/
├── components/       # Yeniden kullanılabilir bileşenler
├── pages/            # Sayfa bileşenleri
│   ├── admin/        # Admin paneli sayfaları
│   ├── driver/       # Sürücü paneli sayfaları
│   └── customer/     # Müşteri sayfaları
├── stores/           # Zustand state yönetimi
├── types/            # TypeScript tip tanımları
└── utils/            # Yardımcı fonksiyonlar

backend/
├── routes/           # API endpoint'leri
└── services/         # İş mantığı servisleri
```

---

## 🎨 Kod Standartları

### TypeScript

- Tüm yeni kod TypeScript ile yazılmalı
- Tip tanımlamaları `src/types/` altında olmalı
- `any` tipinden kaçının

### React

- Fonksiyonel bileşenler kullanın
- Props için interface tanımlayın
- State yönetimi için Zustand kullanın

### Stil

- Tailwind CSS kullanın
- Dark theme uyumlu olmalı
- Responsive tasarım yapın

---

## ✅ Kod Kalitesi

### Lint Kontrolü

```bash
npm run lint
```

### Build Testi

```bash
npm run build
```

Her iki komut da hatasız çalışmalıdır.

---

## 🧪 Test Kullanıcıları

Geliştirme sırasında kullanabileceğiniz test hesapları:

| Rol | E-posta | Şifre |
|-----|---------|-------|
| Sürücü | fatih@test.com | 123456 |
| Sürücü | vedat@test.com | 123456 |

---

## 🔒 Güvenlik

### Asla Yapılmaması Gerekenler

- API key, token gibi bilgileri kod'a yazmayın
- `.env` dosyasını commit etmeyin
- Kullanıcı verilerini log'lamayın

### Environment Variables

Yeni bir ortam değişkeni eklemeniz gerekiyorsa:
1. `.env` dosyasına ekleyin
2. README.md'de belirtin
3. Vercel'de de ekleyin

---

## 📞 Sorularınız İçin

- GitHub Issues açabilirsiniz
- Pull Request'lerde soru sorabilirsiniz

Teşekkürler! 🙏
