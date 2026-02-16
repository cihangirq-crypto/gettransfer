# Secrets ve Kurulum (Twilio + Supabase + Vercel)

Bu depoda **hiçbir API key/token/secret repo içine yazılmaz**. Değerler yalnızca:
- Vercel Project → Settings → Environment Variables
- (opsiyonel) bir secret manager (1Password, Bitwarden, Vault)
üzerinde tutulur.

> Not: Chat/ekran görüntüsü üzerinden paylaşılan secret’lar güvenlik açısından risklidir. Üretimde kullanmadan önce gerekirse key’leri rotate edin.

## Gerekli Environment Variables

### Twilio Verify (SMS OTP)
Uygulama Twilio Verify için iki farklı kimlik doğrulama yöntemini destekler:

**A) API Key ile (önerilen)**
- `TWILIO_API_KEY_SID` (SK…)
- `TWILIO_API_KEY_SECRET`
- `TWILIO_VERIFY_SERVICE_SID` (VA…)

**B) AccountSid + AuthToken ile (alternatif)**
- `TWILIO_ACCOUNT_SID` (AC…)
- `TWILIO_AUTH_TOKEN`
- `TWILIO_VERIFY_SERVICE_SID` (VA…)

### Supabase (kalıcılık)
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

### Supabase Schema Bootstrap (tek seferlik)
Supabase schema otomasyonu için **sadece kurulum sırasında**:
- `SUPABASE_DB_URL` (Postgres connection string)
- `BOOTSTRAP_TOKEN` (rastgele uzun bir string)

Kurulum bittiğinde production’da `SUPABASE_DB_URL` ve `BOOTSTRAP_TOKEN` kaldırılabilir.

### Guest token imzası
- `GUEST_TOKEN_SECRET` (opsiyonel; yoksa service role key’den türetilir)

## Supabase Schema Kurulumu
Supabase SQL Editor’de `supabase/schema.sql` içeriğini çalıştırın veya bootstrap endpoint’i ile otomatik kurulum yapın.

## Bootstrap Endpoint’leri
Schema kurulumunu otomatikleştirmek için backend’de korumalı endpoint’ler vardır:
- `POST /api/admin/bootstrap` (header: `X-Bootstrap-Token: <BOOTSTRAP_TOKEN>`)
- `GET /api/admin/bootstrap/status` (header: `X-Bootstrap-Token: <BOOTSTRAP_TOKEN>`)

Bu endpoint’ler yalnızca `BOOTSTRAP_TOKEN` env tanımlıysa aktiftir.

## Local Çalışma Notu
Yerel geliştirmede `.env.production.local` veya `.secrets/.env.production.local` gibi dosyalar kullanılabilir.
Bu dosyalar gitignore’dadır; repo’ya commit edilmez.

Windows’ta dosyayı sadece kendi kullanıcı hesabına kısıtlamak isterseniz (opsiyonel):
`icacls .secrets /inheritance:r /grant:r %USERNAME%:F`
