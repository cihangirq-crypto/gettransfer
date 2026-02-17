# ⚡ HIZLI DEPLOY KARTI

## 🎯 Tek Komutla Deploy

```bash
cd /home/z/my-project/gettransfer && VERCEL_PROJECT_ID=prj_nmgGq9bUyhqcgwpWDA4oHwPcR679 VERCEL_ORG_ID=team_yHUUI3ESg2rXfdV2V7JfM7zn npx vercel --token "TOKEN" --prod --yes
```

---

## ⛔ YASAKLAR - ASLA YAPMA!

| ❌ Yasak | ✅ Doğru |
|----------|----------|
| `npx vite build` | `npm run build` |
| `/home/z/my-project` dizininde deploy | `/home/z/my-project/gettransfer` dizininde deploy |
| `npx vite` (vite@7.x indirir) | `node ./node_modules/vite/bin/vite.js build` |
| Next.js dosyaları ekleme | Vite projesi olarak kalmalı |

---

## 📋 5 Adımda Deploy

```bash
# 1. Dizine git
cd /home/z/my-project/gettransfer

# 2. Build test et
npm run build

# 3. Git commit
git add -A && git commit -m "msg" && git push origin main

# 4. Deploy
npx vercel --prod --yes

# 5. Kontrol et
# https://gettransfer.vercel.app
```

---

## 🔧 Proje Bilgileri

- **URL:** https://gettransfer.vercel.app
- **GitHub:** https://github.com/cihangirq-crypto/gettransfer
- **Framework:** Vite (Next.js DEĞİL!)
- **Vite Version:** 6.3.5
