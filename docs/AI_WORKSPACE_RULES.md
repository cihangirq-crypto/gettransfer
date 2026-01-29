# AI Workspace Kuralları (GetTransfer)

Bu repo, yeni bir sohbet/agent/AI ile açıldığında aynı şekilde ilerlenebilmesi için “kurallar”ı içerir. **Secret değerler bu dosyada tutulmaz.**

## Temel Prensipler
- Secret’lar repoya yazılmaz (commit yok).
- Üretim secret’ları Vercel Environment Variables’ta tutulur.
- Yerelde secret gerekirse `.secrets/` altında tutulur ve gitignore’dadır.

## Deploy Gerçeği
- Vercel deploy desteği var (serverless handler: `api/index.ts`).
- Socket.IO / sürekli bağlantı gereken realtime özellikler Vercel serverless’ta kısıtlı olabilir; realtime kritikse Render/Railway/Fly tercih edilir.

## Secret Konumu
- **Vercel (Production):** asıl gerçek kaynak
- **Yerel (opsiyonel):** `c:\projeler\gettransfer\.secrets\` altında `.env.production.local`
- Repo içinde sadece şablon/doküman: `.env.production.local.example`

## Twilio (SMS OTP)
- OTP endpoint’leri: `POST /api/otp/send`, `POST /api/otp/verify`
- Kimlik doğrulama: `TWILIO_API_KEY_SID` + `TWILIO_API_KEY_SECRET` + `TWILIO_VERIFY_SERVICE_SID`
- Trial kısıtları nedeniyle “verified numara” şartı olabilir; UI bu hataları kullanıcıya açıklayacak şekilde ele alır.

## Supabase (Rezervasyon Kalıcılığı)
- Booking storage, Supabase env varsa DB’ye yazar; yoksa memory moduna düşer.
- Runtime env’ler:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
- Schema kurulumu için yalnız kurulum anında:
  - `SUPABASE_DB_URL`
  - `BOOTSTRAP_TOKEN`

### IPv4 / Connection String Notu (Önemli)
- Supabase “Direct connection” bazı projelerde **IPv4 uyumlu olmayabilir** (panelde “Not IPv4 compatible” uyarısı).
- Vercel/çoğu sunucu ortamı IPv4 çıkış kullandığı için schema bootstrap gibi işlemlerde **Session pooler URI** tercih edilir.
- Kurulum bitince `SUPABASE_DB_URL` ve `BOOTSTRAP_TOKEN` production’dan kaldırılır (güvenlik).

## Bootstrap (Schema) Güvenliği
- Schema kurulum endpoint’leri `BOOTSTRAP_TOKEN` yoksa devre dışıdır.
- Production’da schema kurulduktan sonra `SUPABASE_DB_URL` ve `BOOTSTRAP_TOKEN` kaldırılır.

## Çalışan Üretim Akışları
- Guest rezervasyon + ödeme ekranı (Kart/Nakit) + rezervasyon kodu
- Guest rezervasyon görüntüleme: telefon + rezervasyon kodu + SMS OTP
