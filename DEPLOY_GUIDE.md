# 🚀 GetTransfer Deploy Rehberi

> ✅ **PROJE YAPILANDIRMASI GÜNCELLENDİ!**
> Artık tek bir dizin var: `/home/z/my-project/` = GetTransfer projesi

---

## 🎯 HIZLI DEPLOY (Kopyala-Yapıştır)

```bash
# Tek komutla deploy:
cd /home/z/my-project && VERCEL_PROJECT_ID=prj_nmgGq9bUyhqcgwpWDA4oHwPcR679 VERCEL_ORG_ID=team_yHUUI3ESg2rXfdV2V7JfM7zn npx vercel --token "YOUR_TOKEN" --prod --yes
```

---

## 📁 PROJE YAPISI

```
/home/z/my-project/              # ⭐ GetTransfer PROJESİ (Vite + React)
├── .git/                        # Git repository
├── src/                         # Frontend kaynak kodlar
├── backend/                     # Backend API (Express)
├── api/                         # Vercel serverless functions
├── package.json                 # Bağımlılıklar (vite@6.x)
├── vite.config.ts               # Vite yapılandırması
├── vercel.json                  # Vercel yapılandırması
└── dist/                        # Build çıktısı
```

---

## ✅ DEPLOY ADIMLARI

### 1. Değişiklikleri Yap

### 2. Build Test Et
```bash
cd /home/z/my-project && npm run build
```

### 3. Git Commit & Push
```bash
git add -A && git commit -m "Açıklama" && git push origin main
```

### 4. Deploy
```bash
VERCEL_PROJECT_ID=prj_nmgGq9bUyhqcgwpWDA4oHwPcR679 VERCEL_ORG_ID=team_yHUUI3ESg2rXfdV2V7JfM7zn npx vercel --token "TOKEN" --prod --yes
```

---

## 🔧 VERCEL BİLGİLERİ

| Bilgi | Değer |
|-------|-------|
| Project ID | `prj_nmgGq9bUyhqcgwpWDA4oHwPcR679` |
| Org ID | `team_yHUUI3ESg2rXfdV2V7JfM7zn` |
| URL | https://gettransfer.vercel.app |
| Framework | `null` (Vite) |
| Build Command | `npm run build` |
| Output Directory | `dist` |

---

## ⚠️ ÖNEMLİ KURALLAR

| ❌ YASAK | ✅ DOĞRU |
|----------|----------|
| `npx vite build` | `npm run build` |
| `npx vite` (vite@7.x indirir) | `node ./node_modules/vite/bin/vite.js build` |

---

## 🛠️ SORUN GİDERME

| Hata | Çözüm |
|------|-------|
| `vite: command not found` | `npm run build` kullan |
| Yanlış proje deploy edildi | `pwd` ile dizini kontrol et |
| Build başarısız | `npm install` çalıştır |

---

## 📝 HIZLI KOMUTLAR

```bash
# Build
npm run build

# Git
git add -A && git commit -m "msg" && git push origin main

# Deploy
VERCEL_PROJECT_ID=prj_nmgGq9bUyhqcgwpWDA4oHwPcR679 VERCEL_ORG_ID=team_yHUUI3ESg2rXfdV2V7JfM7zn npx vercel --token "TOKEN" --prod --yes
```

---

*Son güncelleme: Proje yapısı sadeleştirildi - artık tek dizin var.*
