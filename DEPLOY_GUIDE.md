# 🚀 GetTransfer Deploy Rehberi

## ⚠️ ÖNEMLİ UYARI - SIK YAPILAN HATALAR

### Hata 1: Yanlış Dizinde Çalışmak
```bash
# ❌ YANLIŞ - Ana dizindeyken deploy yapılırsa YANLIŞ PROJE deploy edilir
cd /home/z/my-project
npx vercel --prod  # Bu my-project'i deploy eder!

# ✅ DOĞRU - Proje dizinine girip deploy yapılmalı
cd /home/z/my-project/gettransfer
npx vercel --prod
```

### Hata 2: Git Komutlarında Dizin Belirtmemek
```bash
# ❌ YANLIŞ - Mevcut dizinde çalışır
git add -A
git commit -m "message"

# ✅ DOĞRU - Git dizini ve çalışma dizini belirtilmeli
git --git-dir=/home/z/my-project/gettransfer/.git --work-tree=/home/z/my-project/gettransfer add -A
git --git-dir=/home/z/my-project/gettransfer/.git --work-tree=/home/z/my-project/gettransfer commit -m "message"
git --git-dir=/home/z/my-project/gettransfer/.git --work-tree=/home/z/my-project/gettransfer push origin main
```

### Hata 3: npm Komutlarında Dizin Belirtmemek
```bash
# ❌ YANLIŞ
npm run build

# ✅ DOĞRU
(cd /home/z/my-project/gettransfer && npm run build)
```

---

## 📁 Proje Yapısı

```
/home/z/my-project/              # Ana dizin (Next.js projesi - KULLANILMIYOR)
├── gettransfer/                 # GetTransfer projesi (Vite + React)
│   ├── .git/                    # Git repository
│   ├── src/                     # Kaynak kodlar
│   ├── backend/                 # Backend API
│   ├── package.json             # Bağımlılıklar
│   ├── vite.config.ts           # Vite yapılandırması
│   └── vercel.json              # Vercel yapılandırması
```

---

## 🔧 Vercel Proje Bilgileri

| Bilgi | Değer |
|-------|-------|
| Project ID | `prj_nmgGq9bUyhqcgwpWDA4oHwPcR679` |
| Org ID | `team_yHUUI3ESg2rXfdV2V7JfM7zn` |
| Project Name | `gettransfer` |
| URL | https://gettransfer.vercel.app |
| Token | Vercel Dashboard'dan alınacak |

---

## 🚀 Deploy Komutları

### Yöntem 1: CLI ile Deploy (Önerilen)

```bash
# 1. Proje dizinine git
cd /home/z/my-project/gettransfer

# 2. Environment değişkenlerini set et
export VERCEL_PROJECT_ID=prj_nmgGq9bUyhqcgwpWDA4oHwPcR679
export VERCEL_ORG_ID=team_yHUUI3ESg2rXfdV2V7JfM7zn

# 3. Deploy et
npx vercel --token "YOUR_TOKEN" --prod --yes
```

### Yöntem 2: Tek Satır Komut

```bash
cd /home/z/my-project/gettransfer && VERCEL_PROJECT_ID=prj_nmgGq9bUyhqcgwpWDA4oHwPcR679 VERCEL_ORG_ID=team_yHUUI3ESg2rXfdV2V7JfM7zn npx vercel --token "YOUR_TOKEN" --prod --yes
```

### Yöntem 3: Vercel API ile Ayar Güncelleme

```bash
curl -X PATCH "https://api.vercel.com/v9/projects/prj_nmgGq9bUyhqcgwpWDA4oHwPcR679" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "buildCommand": "npm run build",
    "outputDirectory": "dist",
    "installCommand": "npm install",
    "framework": null
  }'
```

---

## 📤 Git İşlemleri

### Değişiklikleri Commit ve Push

```bash
# Dosyaları ekle
git --git-dir=/home/z/my-project/gettransfer/.git --work-tree=/home/z/my-project/gettransfer add -A

# Commit yap
git --git-dir=/home/z/my-project/gettransfer/.git --work-tree=/home/z/my-project/gettransfer commit -m "Açıklama"

# Push yap
git --git-dir=/home/z/my-project/gettransfer/.git --work-tree=/home/z/my-project/gettransfer push origin main
```

### GitHub URL
https://github.com/cihangirq-crypto/gettransfer

---

## ⚙️ Vercel Ayarları (vercel.json)

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

## 🔄 Otomatik Deploy (GitHub Actions)

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

## 🛠️ Sorun Giderme

### "vite: command not found" Hatası
**Neden:** Vercel yanlış framework algılıyor  
**Çözüm:** API ile `framework: null` ayarla

### "Could not resolve entry module index.html" Hatası
**Neden:** vite.config.ts'de root tanımlı değil  
**Çözüm:** vite.config.ts'e `root: __dirname` ekle

### Yanlış Proje Deploy Edildi
**Neden:** Yanlış dizinde deploy komutu çalıştırıldı  
**Çözüm:** Her zaman önce `cd /home/z/my-project/gettransfer` yap

---

## 📝 Hızlı Referans

```bash
# GETTRANSFER PROJESİ İÇİN HER ZAMAN BU DİZİNİ KULLAN:
PROJECT_DIR="/home/z/my-project/gettransfer"

# Deploy
cd $PROJECT_DIR && VERCEL_PROJECT_ID=prj_nmgGq9bUyhqcgwpWDA4oHwPcR679 VERCEL_ORG_ID=team_yHUUI3ESg2rXfdV2V7JfM7zn npx vercel --token "TOKEN" --prod --yes

# Git push
git --git-dir=$PROJECT_DIR/.git --work-tree=$PROJECT_DIR add -A && git --git-dir=$PROJECT_DIR/.git --work-tree=$PROJECT_DIR commit -m "msg" && git --git-dir=$PROJECT_DIR/.git --work-tree=$PROJECT_DIR push origin main

# Build test
cd $PROJECT_DIR && npm run build
```
