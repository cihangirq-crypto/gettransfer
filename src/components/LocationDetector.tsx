import React, { useState, useEffect } from 'react';
import { MapPin, Navigation, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { toast } from 'sonner';
import OpenStreetMap from '@/components/OpenStreetMap';

interface LocationDetectorProps {
  onLocationDetected: (location: { lat: number; lng: number }) => void;
  onLocationError: (error: string) => void;
}

export const LocationDetector: React.FC<LocationDetectorProps> = ({
  onLocationDetected,
  onLocationError,
}) => {
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [hasAttemptedLocation, setHasAttemptedLocation] = useState(false);
  const watchIdRef = React.useRef<number | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [lastFixTime, setLastFixTime] = useState<number | null>(null);
  const [locationSource, setLocationSource] = useState<'geolocation' | null>(null);
  const locatingRef = React.useRef(false);
  const TURKEY_BOUNDS = { minLat: 35, maxLat: 42.5, minLng: 26, maxLng: 45 };
  const ANTALYA_CENTER = { lat: 36.8969, lng: 30.7133 };
  const isInTurkey = (loc: { lat: number; lng: number }) => (
    loc.lat >= TURKEY_BOUNDS.minLat && loc.lat <= TURKEY_BOUNDS.maxLat &&
    loc.lng >= TURKEY_BOUNDS.minLng && loc.lng <= TURKEY_BOUNDS.maxLng
  );
  const [currentLoc, setCurrentLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [showCalibration, setShowCalibration] = useState(false);
  const [history, setHistory] = useState<Array<{ lat: number; lng: number; acc: number | null; src: string; t: number }>>([]);
  const lastPropagateRef = React.useRef<number>(0);
  const lastLocRef = React.useRef<{ lat: number; lng: number } | null>(null);
  const haversine = (a: {lat:number;lng:number}, b: {lat:number;lng:number}) => {
    const R = 6371000;
    const dLat = (b.lat - a.lat) * Math.PI / 180;
    const dLng = (b.lng - a.lng) * Math.PI / 180;
    const la1 = a.lat * Math.PI / 180;
    const la2 = b.lat * Math.PI / 180;
    const sinDLat = Math.sin(dLat/2);
    const sinDLng = Math.sin(dLng/2);
    const h = sinDLat*sinDLat + Math.cos(la1)*Math.cos(la2)*sinDLng*sinDLng;
    return 2 * R * Math.asin(Math.sqrt(h));
  };
  const propagate = (loc: {lat:number;lng:number}, acc: number | null, src: 'geolocation') => {
    const now = Date.now();
    const prev = lastLocRef.current;
    let allow = true;
    if (acc !== null) {
      if (src === 'geolocation' && acc > 200) allow = false;
    }
    if (prev) {
      const dt = Math.max(1, (now - lastPropagateRef.current) / 1000);
      const dist = haversine(prev, loc);
      const speed = dist / dt;
      if (speed > 50) allow = false;
      if (dist > 200 && (acc ?? 9999) > 300) allow = false;
      if (acc !== null && acc > 1000 && dt < 5) allow = false;
    }
    if (!isInTurkey(loc)) {
      allow = false;
    }
    setHistory(h => [{ lat: loc.lat, lng: loc.lng, acc, src, t: now }, ...h].slice(0, 10));
    if (!allow) {
      setShowCalibration(true);
      toast.warning('Konum doğruluğu düşük, kalibrasyon önerildi');
      return;
    }
    onLocationDetected(loc);
    setCurrentLoc(loc);
    setLocationSource(src);
    lastPropagateRef.current = now;
    lastLocRef.current = loc;
  };
  

  const queryPermission = async () => {
    try {
      // @ts-ignore
      const status = await navigator.permissions?.query?.({ name: 'geolocation' as PermissionName });
      return status?.state as ('granted' | 'prompt' | 'denied' | undefined);
    } catch {
      return undefined;
    }
  };

  

  // Wi‑Fi MLS kaldırıldı; yalnızca tarayıcı Geolocation ve manuel kalibrasyon kullanılır

  const getCurrentLocation = async () => {
    setIsLocating(true);
    locatingRef.current = true;
    setLocationError(null);
    setHasAttemptedLocation(true);

    const isLocalhost = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    const isSecure = window.isSecureContext || isLocalhost;

    // Güvensiz bağlamlarda da geolocation'u dene; bir çok tarayıcı localhost harici IP'de reddedebilir
    // Bu nedenle hata akışında manuel haritaya yönlendiriyoruz

    if (!navigator.geolocation) {
      const error = 'Tarayıcınız konum özelliğini desteklemiyor.';
      setLocationError(error);
      onLocationError(error);
      setIsLocating(false);
      return;
    }

    const options = {
      enableHighAccuracy: true,
      timeout: 30000,
      maximumAge: 0,
    };

    const perm = await queryPermission();
    if (perm === 'denied') {
      toast.error('Konum izni reddedildi. Tarayıcı ayarlarından konum iznini açın.');
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const location = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        
        console.log('📍 Konum başarıyla alındı:', location);
        console.log('📍 Konum doğruluğu:', position.coords.accuracy, 'metre');
        
        const acc = position.coords.accuracy ?? null;
        setAccuracy(acc);
        setLastFixTime(Date.now());
        if (acc !== null && acc > 150) {
          toast.info('Konum doğruluğu düşük, kalibrasyon bekleniyor');
          setCurrentLoc(location);
          setShowCalibration(true);
          // Yalnızca manuel kalibrasyona yönlendir
        } else {
          setIsLocating(false);
          locatingRef.current = false;
          propagate(location, acc, 'geolocation');
          toast.success('Konumunuz alındı');
        }
        try {
          if (watchIdRef.current !== null) {
            navigator.geolocation.clearWatch(watchIdRef.current);
            watchIdRef.current = null;
          }
          watchIdRef.current = navigator.geolocation.watchPosition(
            (pos) => {
              const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
              const acc = pos.coords.accuracy ?? null;
              const improved = acc !== null && (accuracy === null || acc < accuracy);
              if (improved) {
                setAccuracy(acc);
                setLastFixTime(Date.now());
                if (acc <= 200) {
                  propagate(loc, acc, 'geolocation');
                  try {
                    if (watchIdRef.current !== null) {
                      navigator.geolocation.clearWatch(watchIdRef.current);
                      watchIdRef.current = null;
                    }
                  } catch {}
                }
              }
            },
            () => {},
            options
          ) as unknown as number;
        } catch {}
      },
      (error) => {
        setIsLocating(false);
        locatingRef.current = false;
        let errorMessage = '';
        
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Konum izni reddedildi. Lütfen tarayıcı ayarlarından konum iznini verin.';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Konum bilgisi alınamadı. Lütfen internet bağlantınızı kontrol edin.';
            break;
          case error.TIMEOUT:
            errorMessage = 'Konum alma işlemi zaman aşımına uğradı. Lütfen tekrar deneyin.';
            break;
          default:
            errorMessage = 'Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.';
            break;
        }
        
        console.error('📍 Konum alma hatası:', error);
        setLocationError(errorMessage);
        onLocationError(errorMessage);
        setShowCalibration(true);
      },
      options
    );

    // Ek MLS/IP denemeleri kaldırıldı
  };

  // Sayfa yüklendiğinde doğrudan geolocation dene
  useEffect(() => {
    if (!hasAttemptedLocation) {
      const timer = setTimeout(() => {
        console.log('📍 Otomatik geolocation başlatılıyor...');
        getCurrentLocation();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [hasAttemptedLocation]);

  const handleManualLocation = () => {
    const defaultLocation = ANTALYA_CENTER;
    console.log('📍 Kalibrasyon için harita açılıyor:', defaultLocation);
    setIsLocating(false);
    setLocationError(null);
    setCurrentLoc(defaultLocation);
    setShowCalibration(true);
  };

  const analyzeLocationHistory = () => {
    if (history.length < 3) return null as any;
    const recent = history.slice(0, 3);
    if (recent.every(r => r.src === recent[0].src)) {
      if (recent[0].acc !== null && recent[0].acc < 100) {
        return { lat: recent[0].lat, lng: recent[0].lng, accuracy: recent[0].acc };
      }
    }
    const best = recent.reduce((best: any, cur) => {
      if (!best) return cur;
      if (cur.acc !== null && best.acc !== null && cur.acc < best.acc) return cur;
      return best;
    }, null as any);
    if (best && best.acc !== null && best.acc < 200) {
      return { lat: best.lat, lng: best.lng, accuracy: best.acc };
    }
    return null as any;
  };

  useEffect(() => {
    const id = setInterval(() => {
      const analyzed = analyzeLocationHistory();
      if (analyzed && currentLoc) {
        const dist = haversine(currentLoc, { lat: analyzed.lat, lng: analyzed.lng });
        if (dist > 50) {
          propagate({ lat: analyzed.lat, lng: analyzed.lng }, analyzed.accuracy ?? null, 'geolocation');
        }
      }
    }, 10000);
    return () => clearInterval(id);
  }, [history, currentLoc]);

  return (
    <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
          <MapPin className="h-5 w-5 mr-2 text-blue-600" />
          Konumunuzu Belirleyin
        </h3>
        {isLocating && (
          <div className="flex items-center text-sm text-blue-600">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
            Konum aranıyor...
          </div>
        )}
      </div>

      {!hasAttemptedLocation && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
          <div className="flex items-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-600 mr-2"></div>
            <span className="text-sm text-yellow-800">Konumunuz otomatik olarak alınıyor...</span>
          </div>
        </div>
      )}

      {locationError ? (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
          <div className="flex items-center mb-2">
            <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
            <span className="text-red-800 font-medium">Konum Alınamadı</span>
          </div>
          <p className="text-red-700 text-sm mb-3">{locationError}</p>
          <div className="flex space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={getCurrentLocation}
              disabled={isLocating}
            >
              <Navigation className="h-4 w-4 mr-1" />
              Tekrar Dene
            </Button>
            <Button
              size="sm"
              onClick={handleManualLocation}
              disabled={isLocating}
            >
              <MapPin className="h-4 w-4 mr-1" />
              Manuel Konum
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-gray-600 text-sm">
            Konumunuzu cihazınızın konum servisleri (GPS/Wi‑Fi/IP) ile belirliyoruz.
          </p>
          <div className="flex space-x-2">
            <Button
              onClick={getCurrentLocation}
              disabled={isLocating}
              className="flex-1"
            >
              <Navigation className="h-4 w-4 mr-2" />
              {isLocating ? 'Konum Aranıyor...' : 'Konumu Kalibre Et'}
            </Button>
            <Button
              variant="outline"
              onClick={handleManualLocation}
              disabled={isLocating}
            >
              <MapPin className="h-4 w-4 mr-2" />
              Manuel
            </Button>
          </div>
        </div>
      )}

      <div className="mt-4 p-3 bg-blue-50 rounded-md">
        <div className="text-xs text-blue-700">
          <p>
            💡 İpucu: Daha hassas sonuç için konum izni verin.
          </p>
          {accuracy !== null && (
            <p className="mt-1">Doğruluk: ±{Math.round(accuracy)} m {lastFixTime ? `• ${new Date(lastFixTime).toLocaleTimeString()}` : ''}</p>
          )}
          {locationSource && (
            <p className="mt-1">Kaynak: Tarayıcı Geolocation</p>
          )}
          {history.length > 0 && (
            <div className="mt-2">
              {history.slice(0,3).map((h, i) => (
                <p key={i} className="text-[11px] text-blue-700">
                  {new Date(h.t).toLocaleTimeString()} • {h.src} • ±{h.acc ? Math.round(h.acc) : '?'}m
                </p>
              ))}
            </div>
          )}
        </div>
      </div>
  {showCalibration && currentLoc && (
    <div className="mt-4">
      <OpenStreetMap
        center={currentLoc}
        customerLocation={currentLoc}
        drivers={[]}
        draggableCustomer
        onCustomerDragEnd={(loc) => {
          setShowCalibration(false);
          setIsLocating(false);
          locatingRef.current = false;
          propagate(loc, 50, 'geolocation');
          toast.success('Konum el ile güncellendi');
        }}
        onMapClick={(loc) => {
          setShowCalibration(false);
          setIsLocating(false);
          locatingRef.current = false;
          propagate(loc, 50, 'geolocation');
          toast.success('Konum el ile güncellendi');
        }}
        accuracy={accuracy}
        className="h-64 w-full"
      />
    </div>
  )}

      
    </div>
  );
};
