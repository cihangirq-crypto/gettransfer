## Kök Neden Analizi
- SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY üretimde okunmuyor olabilir; bu yüzden serverless fonksiyon Supabase’e bağlanamıyor.
- Serverless örneklerinde bellek verisi paylaşılmadığından apply → list aynı örneğe düşmediğinde yeni başvuru admin’de görünmüyor.

## Teşhis İyileştirmeleri
1. /api/drivers/diag çıktısını genişlet: env varların var/yok bilgisini (değer göstermeden) döndür.
2. Log seviyesini artır: storage.ts içi hata yakalamalarında kod ve mesajı kaydet (PII sızdırmadan).

## Bağlantı Güvenceleri
1. Supabase istemcisi kuralları:
   - Öncelik: SUPABASE_SERVICE_ROLE_KEY varsa onu kullan.
   - Yoksa SUPABASE_ANON_KEY ile bağlan (RLS’yi kapattığımız için yazma/okuma mümkün).
2. storage.ts’i güncelle:
   - saveDriver/getDriver/listDriversByStatus tümünde client seçimini yukarıdaki kurala göre yap.
   - Hata durumunda geçici seed yerine Supabase Storage (bucket) JSON fallback’ini aktif et (drivers_data/drivers.json).

## Apply Akışı Düzeltmesi
1. /api/drivers/apply sonrası:
   - saveDriver(d) (Supabase upsert)
   - storage bucket’a da yaz (fallback senkronu)
2. Admin listesi uçları:
   - listDriversByStatus('pending'|'approved'|'rejected') Supabase > bucket > bellek sırasıyla döndürsün.

## Admin UI Doğrulama
1. AdminDrivers.tsx veri kaynakları (pending/approved/rejected) mevcut uçlara bağlı; ek UI değişikliği gerekmez.
2. “Yenile” aksiyonu veri kaynağını tekrar çağırır; yeni başvuru anında görünmeli.

## Test ve Doğrulama
1. API testleri:
   - POST /api/drivers/apply → 201
   - GET /api/drivers/pending → başvurunun göründüğünü doğrula
   - POST /api/drivers/approve → GET /api/drivers/list?status=approved içinde görünür
2. Manuel prod doğrulama:
   - /api/drivers/diag → connected:true ve canQuery:true
   - Admin panelinde yeni başvuruyu gör.

## Monitoring ve Tekrarı Önleme
1. Basit health logları: storage bağlantı hatalarında kısa metin log.
2. Opsiyonel: Vercel Cron ile bucket→Supabase senkronu periyodik (gerekirse).

Onayından sonra:
- storage.ts, drivers.ts ve diag route’larını güncelleyeceğim
- SUPABASE_ANON_KEY env’i ekleyip yeniden deploy edeceğim
- Uçtan uca akışı prod üzerinde doğrulayacağım