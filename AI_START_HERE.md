# AI Start Here (GetTransfer)

Bu repo yeni bir sohbet/agent/AI ile açıldığında hızlıca bağlam kurmak için başlangıç dokümanıdır. **Secret değerler repo içine yazılmaz.**

## Çalışma Kuralları
- Secret’lar asla commit edilmez; Vercel Environment Variables “tek gerçek kaynak”tır.
- Yerelde secret gerekiyorsa `.secrets/` altında tutulur ve gitignore’dadır.
- Üretimde schema kurulum işleri bittikten sonra `SUPABASE_DB_URL` ve `BOOTSTRAP_TOKEN` kaldırılır.

## Hızlı Durum Kontrolü
- Uygulama durumu: `GET /api/health`
- Konfigürasyon durumu (secret ifşa etmeden): `GET /api/diag`

## Deploy Notu
- Bu repo Vercel’de serverless olarak deploy edilebilir (handler: `api/index.ts`).
- Socket.IO gibi kalıcı WebSocket bağlantıları Vercel serverless’ta sınırlı olabilir; yoğun realtime ihtiyaçları için Render/Railway/Fly gibi bir host daha uygundur.

## Temel Akışlar
- Guest rezervasyon → sürücü teklifi seçimi → ödeme (Kart/Nakit) → rezervasyon kodu
- Guest rezervasyon görüntüleme → telefon + rezervasyon kodu → SMS OTP doğrulama

## En Önemli Dosyalar
- Kurallar: [AI_WORKSPACE_RULES.md](file:///c:/projeler/gettransfer/docs/AI_WORKSPACE_RULES.md)
- Secret/kurulum: [SECRETS_AND_SETUP.md](file:///c:/projeler/gettransfer/docs/SECRETS_AND_SETUP.md)
