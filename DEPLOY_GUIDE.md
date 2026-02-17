# 🚀 GetTransfer Deploy Rehberi - KAPSAMLI KILAVUZ

> ⚠️ **Bu belge, deploy sırasında yapılan tekrarlayan hataları önlemek için oluşturulmuştur.**
> Her deploy öncesi bu belgeyi okuyun!

---

## 🎯 HIZLI DEPLOY (Kopyala-Yapıştır)

```bash
# Tek komutla deploy:
cd /home/z/my-project/gettransfer && VERCEL_PROJECT_ID=prj_nmgGq9bUyhqcgwpWDA4oHwPcR679 VERCEL_ORG_ID=team_yHUUI3ESg2rXfdV2V7JfM7zn npx vercel --token "YOUR_VERCEL_TOKEN" --prod --yes --force
```

> ⚠️ **TOKEN:** Vercel token'ı güvenlik nedeniyle burada yazmıyor. Token'ı Vercel Dashboard'dan al veya mevcut token'ı kullan.

---

## 📁 PROJE YAPISI - ÖNEMLİ!

```
/home/z/my-project/              # Ana dizin (Next.js projesi - KULLANILMIYOR!)
│
└── gettransfer/                 # ⭐ GetTransfer PROJESİ - TÜM İŞLEMLER BURADA
    ├── .git/                    # Git repository
    ├── src/                     # Frontend kaynak kodlar (React + Vite)
    ├── backend/                 # Backend API (Express)
    ├── api/                     # Vercel serverless functions
    ├── package.json             # Bağımlılıklar (vite@6.3.5)
    ├── vite.config.ts           # Vite yapılandırması
    ├── vercel.json              # Vercel yapılandırması
    └── dist/                    # Build çıktısı
```

**⚠️ KRİTİK UYARI:** Ana dizin `/home/z/my-project/` bir Next.js projesidir. GetTransfer Vite projesidir. Bu iki proje KARİŞTIRILMAMALIDIR!

---

## ❌ SIK YAPILAN HATALAR VE ÇÖZÜMLERİ

### Hata 1: Yanlış Dizinde Deploy Yapmak

**Durum:**
```bash
# ❌ YANLIŞ - Ana dizindeyken deploy
cd /home/z/my-project
npx vercel --prod
# Sonuç: Next.js projesi (boş) deploy edilir, GetTransfer görünmez!
```

**Neden Olur:**
- Vercel CLI, bulunduğu dizindeki dosyaları yükler
- Ana dizin `/home/z/my-project/` Next.js projesi olduğu için yanlış proje yüklenir

**Çözüm:**
```bash
# ✅ DOĞRU - Proje dizinine girip deploy
cd /home/z/my-project/gettransfer
npx vercel --prod
```

**Önleme Kuralı:**
> Her deploy komutundan önce `pwd` ile dizini kontrol et! `/home/z/my-project/gettransfer` olmalı!

---

### Hata 2: Vite Versiyon Uyuşmazlığı

**Durum:**
```bash
# ❌ YANLIŞ
npx vite build
# Hata: vite@7.x indirilir, proje vite@6.x ile yazılmış
# Sonuç: "Could not resolve entry module" veya uyumsuzluk hataları
```

**Neden Olur:**
- `npx vite` her zaman EN SON versiyonu (şu an 7.x) indirir
- Proje `vite@6.3.5` ile yapılandırılmış
- Farklı versiyonlar farklı yapılandırma formatları kullanır

**Çözüm:**
```bash
# ✅ DOĞRU YÖNTEM 1: npm script kullan
npm run build

# ✅ DOĞRU YÖNTEM 2: node_modules'tan çalıştır
node ./node_modules/vite/bin/vite.js build

# ✅ DOĞRU YÖNTEM 3: Belirli versiyon belirt
npx --yes vite@6.3.5 build

# ❌ YANLIŞ: Versiyonsuz npx
npx vite build  # Bu vite@7.x indirir!
```

**package.json'da Build Script:**
```json
{
  "scripts": {
    "build": "node ./node_modules/vite/bin/vite.js build"
  }
}
```

**Önleme Kuralı:**
> Asla `npx vite` kullanma! Her zaman `npm run build` veya tam yolu kullan!

---

### Hata 3: ESM Module ve `__dirname` Hatası

**Durum:**
```
Error: Could not resolve entry module index.html
```

**Neden Olur:**
- Proje `"type": "module"` (ESM) kullanıyor
- ESM'de `__dirname` değişkeni tanımlı değil
- vite.config.ts'te `root` veya `input` yanlış tanımlanmış

**Çözüm (vite.config.ts):**
```typescript
import { fileURLToPath } from 'url'
import { resolve } from 'path'

// ESM için __dirname oluştur
const __dirname = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  root: __dirname,  // ⭐ Bu satır KRİTİK!
  build: {
    rollupOptions: {
      input: resolve(__dirname, 'index.html'),  // ⭐ Tam yol gerekli!
    }
  }
})
```

**Önleme Kuralı:**
> ESM projesinde asla `__dirname` kullanma! Her zaman `fileURLToPath` ile oluştur!

---

### Hata 4: Vercel Yanlış Framework Algılama

**Durum:**
- Vercel projeyi Next.js olarak algılar
- `next-env.d.ts` dosyası varsa bu olur
- Build komutu Next.js için çalışır, Vite için değil

**Neden Olur:**
- `next-env.d.ts` veya `next.config.js` dosyası varsa
- Vercel otomatik Next.js algılar

**Çözüm:**
```bash
# 1. Yanlış dosyaları sil
rm next-env.d.ts  # Varsa

# 2. Vercel API ile framework'ü null yap
curl -X PATCH "https://api.vercel.com/v9/projects/prj_nmgGq9bUyhqcgwpWDA4oHwPcR679" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"framework": null, "buildCommand": "npm run build", "outputDirectory": "dist"}'
```

**Önleme Kuralı:**
> Vite projesine Next.js dosyaları ekleme! `next-env.d.ts`, `next.config.js` sil!

---

### Hata 5: Git Komutlarında Dizin Belirtmemek

**Durum:**
```bash
# ❌ YANLIŞ
git add -A
git commit -m "message"
# Sonuç: Yanlış dosyalar eklenir veya hata verir
```

**Çözüm:**
```bash
# ✅ DOĞRU - Git dizini ve çalışma dizini belirtilmeli
git --git-dir=/home/z/my-project/gettransfer/.git --work-tree=/home/z/my-project/gettransfer add -A
git --git-dir=/home/z/my-project/gettransfer/.git --work-tree=/home/z/my-project/gettransfer commit -m "message"
git --git-dir=/home/z/my-project/gettransfer/.git --work-tree=/home/z/my-project/gettransfer push origin main
```

---

## 🔄 TAM DEPLOY İŞ AKIŞI

### Adım 1: Dizini Kontrol Et
```bash
pwd
# Çıktı: /home/z/my-project/gettransfer OLMALI!
# Değilse:
cd /home/z/my-project/gettransfer
```

### Adım 2: Kod Değişikliklerini Yap
```bash
# Dosyaları düzenle...
```

### Adım 3: Local Build Test Et
```bash
npm run build
# Hata yoksa devam et
```

### Adım 4: Git Commit ve Push
```bash
git --git-dir=/home/z/my-project/gettransfer/.git --work-tree=/home/z/my-project/gettransfer add -A
git --git-dir=/home/z/my-project/gettransfer/.git --work-tree=/home/z/my-project/gettransfer commit -m "Açıklama"
git --git-dir=/home/z/my-project/gettransfer/.git --work-tree=/home/z/my-project/gettransfer push origin main
```

### Adım 5: Vercel Deploy
```bash
cd /home/z/my-project/gettransfer && VERCEL_PROJECT_ID=prj_nmgGq9bUyhqcgwpWDA4oHwPcR679 VERCEL_ORG_ID=team_yHUUI3ESg2rXfdV2V7JfM7zn npx vercel --token "TOKEN" --prod --yes
```

---

## 🔧 VERCEL PROJE BİLGİLERİ

| Bilgi | Değer |
|-------|-------|
| Project ID | `prj_nmgGq9bUyhqcgwpWDA4oHwPcR679` |
| Org ID | `team_yHUUI3ESg2rXfdV2V7JfM7zn` |
| Project Name | `gettransfer` |
| Production URL | https://gettransfer.vercel.app |
| Framework | `null` (Vite - Next.js değil!) |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Install Command | `npm install` |

---

## ⚙️ VERCEL AYARLARI (vercel.json)

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/index" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

---

## 📤 GITHUB ENTEGRASYONU

### Repository URL
https://github.com/cihangirq-crypto/gettransfer

### GitHub Actions ile Otomatik Deploy

Dosya: `.github/workflows/deploy.yml`
```yaml
name: Deploy to Vercel
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build
        run: npm run build
      
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
```

### GitHub Secrets Ekle
1. https://github.com/cihangirq-crypto/gettransfer/settings/secrets/actions
2. Eklenecek secrets:
   - `VERCEL_TOKEN`: Vercel Dashboard'dan alınacak
   - `VERCEL_ORG_ID`: `team_yHUUI3ESg2rXfdV2V7JfM7zn`
   - `VERCEL_PROJECT_ID`: `prj_nmgGq9bUyhqcgwpWDA4oHwPcR679`

---

## 🛠️ SORUN GİDERME

| Hata Mesajı | Neden | Çözüm |
|-------------|-------|-------|
| `vite: command not found` | npx vite@7.x indiriliyor | `npm run build` kullan |
| `Could not resolve entry module index.html` | ESM'de `__dirname` yok | vite.config.ts'te ESM `__dirname` kullan |
| Yanlış proje deploy edildi | Yanlış dizin | `cd /home/z/my-project/gettransfer` |
| Framework Next.js algılandı | next-env.d.ts var | Dosyayı sil, API ile `framework: null` yap |
| Build başarısız | Versiyon uyumsuzluğu | `npm install` ile bağımlılıkları güncelle |

---

## ✅ DEPLOY ÖNCESİ KONTROL LİSTESİ

```bash
# 1. Dizin kontrolü
pwd  # → /home/z/my-project/gettransfer

# 2. Branch kontrolü
git --git-dir=/home/z/my-project/gettransfer/.git --work-tree=/home/z/my-project/gettransfer branch
# → * main

# 3. Değişiklik kontrolü
git --git-dir=/home/z/my-project/gettransfer/.git --work-tree=/home/z/my-project/gettransfer status
# → nothing to commit (temiz olmalı)

# 4. Build testi
npm run build
# → Done in X.XXs (hata yok)

# 5. Deploy
VERCEL_PROJECT_ID=prj_nmgGq9bUyhqcgwpWDA4oHwPcR679 VERCEL_ORG_ID=team_yHUUI3ESg2rXfdV2V7JfM7zn npx vercel --token "TOKEN" --prod --yes
```

---

## 📝 HIZLI REFERANS KARTI

```bash
# ═══════════════════════════════════════════════════════════════
# GETTRANSFER PROJESİ - HIZLI KOMUTLAR
# ═══════════════════════════════════════════════════════════════

# Proje dizini
PROJECT_DIR="/home/z/my-project/gettransfer"

# Dizine git
cd $PROJECT_DIR

# Build
npm run build

# Git işlemleri
git --git-dir=$PROJECT_DIR/.git --work-tree=$PROJECT_DIR add -A
git --git-dir=$PROJECT_DIR/.git --work-tree=$PROJECT_DIR commit -m "message"
git --git-dir=$PROJECT_DIR/.git --work-tree=$PROJECT_DIR push origin main

# Deploy (tek satır)
cd $PROJECT_DIR && VERCEL_PROJECT_ID=prj_nmgGq9bUyhqcgwpWDA4oHwPcR679 VERCEL_ORG_ID=team_yHUUI3ESg2rXfdV2V7JfM7zn npx vercel --token "TOKEN" --prod --yes

# ═══════════════════════════════════════════════════════════════
# ⚠️ ASLA YAPMAMA KURALLARI
# ═══════════════════════════════════════════════════════════════
# ❌ npx vite build (vite@7.x indirir!)
# ❌ /home/z/my-project dizininde deploy (yanlış proje!)
# ❌ next-env.d.ts dosyası ekleme (Next.js algılanır!)
# ❌ cd yapmadan deploy komutu çalıştırma!
# ═══════════════════════════════════════════════════════════════
```

---

## 🔒 GÜVENLİK NOTLARI

- Vercel Token'ı herkese açık repositorielere commit etme!
- GitHub Secrets kullan
- Production deploy öncesi mutlaka local test et

---

*Son güncelleme: Deploy sırasında yapılan hataları önlemek için oluşturuldu.*
