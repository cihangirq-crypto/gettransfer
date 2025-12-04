import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import OpenStreetMap from '@/components/OpenStreetMap';
import { DriverStatusCard } from '@/components/DriverStatusCard';
import { LocationDetector } from '@/components/LocationDetector';
import { useBookingStore } from '@/stores/bookingStore';
import { useAuthStore } from '@/stores/authStore';
import { MapPin, Users, Car, Navigation, Clock } from 'lucide-react';
import { API } from '@/utils/api'
import { toast } from 'sonner';

interface ImmediateRideForm {
  destinationAddress: string;
  passengerCount: number;
  vehicleType: 'sedan' | 'suv' | 'van' | 'luxury';
  pickupAddress?: string;
}

export const ImmediateRideRequest: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { searchDrivers, availableDrivers, startRealTimeUpdates, stopRealTimeUpdates, refreshApprovedDriversNear } = useBookingStore();
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [destinationLocation, setDestinationLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState<string | null>(null);
  const [estimatedPrice, setEstimatedPrice] = useState<number>(0);
  const [estimatedDistance, setEstimatedDistance] = useState<number>(0);
  const [estimatedTime, setEstimatedTime] = useState<number>(0);

  const { register, handleSubmit, formState: { errors }, setValue, watch } = useForm<ImmediateRideForm>();
  const destinationAddress = watch('destinationAddress');
  const [suggestions, setSuggestions] = useState<Array<{ label: string; lat: number; lng: number; category: 'airport'|'address' }>>([]);
  const [showSug, setShowSug] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPhone, setGuestPhone] = useState('');

  // Get current location
  const getCurrentLocation = () => {
    setIsLocating(true);
    
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setCurrentLocation(location);
          setIsLocating(false);
          
          // Get address from coordinates
          getAddressFromCoords(location.lat, location.lng);
          
          toast.success('Konumunuz bulundu');
        },
        (error) => {
          setIsLocating(false);
          toast.error('Konumunuz alınamadı. Lütfen manuel adres girin.');
          console.error('Geolocation error:', error);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000, // 5 minutes
        }
      );
    } else {
      setIsLocating(false);
      toast.error('Tarayıcınız konum özelliğini desteklemiyor.');
    }
  };

  // Get address from coordinates using reverse geocoding
  const getAddressFromCoords = async (lat: number, lng: number) => {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`;
      const res = await fetch(url, { headers: { 'User-Agent': 'gettransfer-app/1.0' } });
      if (!res.ok) throw new Error('reverse geocoding failed');
      const data = await res.json();
      const addr = data?.display_name || 'Mevcut Konum';
      setValue('pickupAddress', addr);
    } catch (error) {
      console.error('Reverse geocoding error:', error);
      setValue('pickupAddress', 'Mevcut Konum');
    }
  };

  // Calculate distance and price
  const calculateDistanceAndPrice = (from: { lat: number; lng: number }, to: { lat: number; lng: number }) => {
    // Haversine formula for distance calculation
    const R = 6371; // Earth's radius in km
    const dLat = (to.lat - from.lat) * Math.PI / 180;
    const dLng = (to.lng - from.lng) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(from.lat * Math.PI / 180) * Math.cos(to.lat * Math.PI / 180) *
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;
    
    setEstimatedDistance(Math.round(distance * 10) / 10);
    setEstimatedPrice(Math.round(distance * 1 * 100) / 100); // 1€ per km
    setEstimatedTime(Math.round(distance * 2)); // 2 minutes per km
  };

  // Get destination coordinates from address
  const getDestinationCoords = async (address: string) => {
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&namedetails=1&extratags=1&limit=10&q=${encodeURIComponent(address)}`;
      const res = await fetch(url, { headers: { 'User-Agent': 'gettransfer-app/1.0' } });
      if (!res.ok) throw new Error('geocoding failed');
      const items = await res.json();
      if (Array.isArray(items) && items.length > 0) {
        const first = items[0];
        const coords = { lat: parseFloat(first.lat), lng: parseFloat(first.lon) };
        setDestinationLocation(coords);
        if (currentLocation) calculateDistanceAndPrice(currentLocation, coords);
      } else {
        toast.error('Adres bulunamadı');
      }
    } catch (error) {
      console.error('Geocoding error:', error);
      toast.error('Adres aranırken hata oluştu');
    }
  };

  // Handle destination address change
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (!destinationAddress || destinationAddress.length < 2) { setSuggestions([]); setShowSug(false); return; }
      const q = destinationAddress.trim();
      const params = new URLSearchParams({ q });
      if (currentLocation) { params.set('lat', String(currentLocation.lat)); params.set('lng', String(currentLocation.lng)); }
      try {
        const res = await fetch(`${API}/places/search?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          const list = Array.isArray(data?.data) ? data.data as Array<{label:string;lat:number;lng:number;category:'airport'|'address'}> : [];
          if (list.length > 0) {
            setSuggestions(list);
            setShowSug(true);
            return;
          }
        }
      } catch {}

      try {
        let bbox = '';
        if (currentLocation) {
          const dLat = 0.35, dLng = 0.35;
          const left = (currentLocation.lng - dLng).toFixed(6);
          const right = (currentLocation.lng + dLng).toFixed(6);
          const top = (currentLocation.lat + dLat).toFixed(6);
          const bottom = (currentLocation.lat - dLat).toFixed(6);
          bbox = `&viewbox=${left},${top},${right},${bottom}&bounded=1`;
        }
        const base = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&namedetails=1&extratags=1&limit=10${bbox}&q=${encodeURIComponent(q)}`;
        const direct = await fetch(base, { headers: { 'User-Agent': 'gettransfer-app/1.0', 'Accept-Language': 'tr' } });
        if (direct.ok) {
          const arr = await direct.json();
          const mapped = (Array.isArray(arr) ? arr : []).map((it: any) => {
            const label = String(it.display_name);
            const cls = String(it.class || '').toLowerCase();
            const type = String(it.type || '').toLowerCase();
            const cat = (cls === 'aeroway' || type === 'aerodrome' || type === 'terminal') ? 'airport' : 'address';
            return { label, lat: parseFloat(it.lat), lng: parseFloat(it.lon), category: cat as 'airport'|'address' };
          });
          setSuggestions(mapped);
          setShowSug(true);
          return;
        }
      } catch {}
      setSuggestions([]);
      setShowSug(false);
    };
    const timeoutId = setTimeout(fetchSuggestions, 300);
    return () => clearTimeout(timeoutId);
  }, [destinationAddress, currentLocation]);

  // Search for nearby drivers
  const searchNearbyDrivers = async () => {
    if (currentLocation) {
      await searchDrivers(
        { lat: currentLocation.lat, lng: currentLocation.lng, address: 'Mevcut Konum' },
        { lat: destinationLocation?.lat || 0, lng: destinationLocation?.lng || 0, address: destinationAddress },
        { vehicleType: watch('vehicleType'), passengerCount: watch('passengerCount') }
      );
    }
  };

  // Handle form submission
  const onSubmit = async (data: ImmediateRideForm) => {
    if (!user) {
      setShowRegister(true);
      return;
    }
    if (!currentLocation) {
      toast.error('Lütfen önce konumunuzu belirleyin');
      return;
    }

    if (!destinationLocation) {
      toast.error('Lütfen varış adresinizi girin');
      return;
    }

    try {
      const bookingData = {
        pickupLocation: {
          lat: currentLocation.lat,
          lng: currentLocation.lng,
          address: data.pickupAddress || 'Mevcut Konum',
        },
        dropoffLocation: {
          lat: destinationLocation.lat,
          lng: destinationLocation.lng,
          address: data.destinationAddress,
        },
        pickupTime: new Date().toISOString(),
        passengerCount: data.passengerCount,
        vehicleType: data.vehicleType,
        estimatedPrice,
        estimatedDistance,
        estimatedTime,
        isImmediate: true,
      };
      try {
        const res = await fetch(`${API}/bookings/create`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...bookingData, customerId: user?.id, basePrice: estimatedPrice }) });
        const j = await res.json();
        if (res.ok && j.success) {
          localStorage.setItem('pendingBooking', JSON.stringify({ id: j.data.id, booking: bookingData }));
          toast.success('Talebiniz oluşturuldu');
        }
      } catch {}
      navigate('/select-driver', { state: bookingData });
      // Demo simülasyonları kaldırıldı
    } catch (error) {
      toast.error('Rezervasyon oluşturulamadı');
    }
  };

  // Auto-get location on component mount
  useEffect(() => {
    // Konum algılama bileşeni artık otomatik olarak çalışıyor
    console.log('📍 ImmediateRideRequest bileşeni yüklendi - konum algılama başlatılıyor...');
    try {
      const saved = localStorage.getItem('pendingBooking');
      if (saved) {
        const parsed = JSON.parse(saved);
        const b = parsed?.booking;
        if (b?.pickupLocation && b?.dropoffLocation) {
          setCurrentLocation({ lat: b.pickupLocation.lat, lng: b.pickupLocation.lng });
          setDestinationLocation({ lat: b.dropoffLocation.lat, lng: b.dropoffLocation.lng });
          setValue('destinationAddress', b.dropoffLocation.address);
          setValue('pickupAddress', b.pickupLocation.address);
          calculateDistanceAndPrice({ lat: b.pickupLocation.lat, lng: b.pickupLocation.lng }, { lat: b.dropoffLocation.lat, lng: b.dropoffLocation.lng });
        }
      }
    } catch {}
  }, []);

  const handleLocationDetected = (location: { lat: number; lng: number }) => {
    setCurrentLocation(location);
    // Konum bulunduğunda yakındaki sürücüleri ara
    searchNearbyDrivers();
    // Demo seed kaldırıldı
    refreshApprovedDriversNear(location);
    startRealTimeUpdates();
  };

  const handleLocationError = (error: string) => {
    console.error('Konum hatası:', error);
    toast.error('Konum alınamadı. Lütfen konum izni verin veya haritada seçin.');
  };

  // Start real-time updates when drivers are available
  useEffect(() => {
    if (availableDrivers.length > 0) {
      startRealTimeUpdates();
    }
    
    return () => {
      stopRealTimeUpdates();
    };
  }, [availableDrivers.length, startRealTimeUpdates, stopRealTimeUpdates]);

  // Demo simülasyonları kaldırıldı

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Side - Map */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="h-96 lg:h-full min-h-96 map-container">
              {currentLocation ? (
                <OpenStreetMap
                  center={currentLocation}
                  customerLocation={currentLocation}
                  destination={destinationLocation || undefined}
                  drivers={availableDrivers
                    .filter(d => d.currentLocation)
                    .map(d => ({
                      id: d.id,
                      name: d.name,
                      location: { lat: d.currentLocation!.lat, lng: d.currentLocation!.lng },
                      rating: d.rating,
                      available: d.isAvailable,
                    }))}
                  onDriverClick={(driver) => {
                    setSelectedDriver(driver.id);
                    toast.info(`Seçilen sürücü: ${driver.name}`);
                  }}
                  highlightDriverId={selectedDriver || undefined}
                />
              ) : (
                <div className="h-full flex items-center justify-center bg-gray-100 p-6">
                  <LocationDetector
                    onLocationDetected={handleLocationDetected}
                    onLocationError={handleLocationError}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Right Side - Booking Form */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              Hemen Araç Çağır
            </h2>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {/* Current Location Status */}
              {currentLocation && (
                <div className="bg-green-50 border border-green-200 rounded-md p-3 mb-4">
                  <div className="flex items-center">
                    <MapPin className="h-4 w-4 text-green-600 mr-2" />
                    <span className="text-sm text-green-800 font-medium">
                      Konumunuz Belirlendi
                    </span>
                  </div>
                  <p className="text-xs text-green-700 mt-1">
                    En yakın sürücüler bulunuyor...
                  </p>
                </div>
              )}

              {/* Destination */}
              <div className="relative">
                <Input
                  label="Varış Adresi"
                  type="text"
                  placeholder="Havaalanı, otel, kapı no..."
                  leftIcon={<MapPin className="h-5 w-5 text-gray-400" />}
                  {...register('destinationAddress', {
                    required: 'Varış adresi gereklidir',
                    minLength: { value: 2, message: 'En az 2 karakter' },
                  })}
                  onFocus={() => setShowSug(suggestions.length > 0)}
                  error={errors.destinationAddress?.message}
                />
                {showSug && suggestions.length > 0 && (
                  <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-64 overflow-y-auto">
                    {['airport','address'].map(cat => (
                      <div key={cat}>
                        <div className="px-3 py-1 text-xs text-gray-500 bg-gray-50">{cat === 'airport' ? 'Havaalanları' : 'Adresler'}</div>
                        {suggestions.filter(s => s.category === (cat as any)).map((s, idx) => (
                          <button
                            key={`${cat}-${idx}`}
                            type="button"
                            className="w-full text-left px-3 py-2 hover:bg-blue-50"
                            onClick={() => {
                              setValue('destinationAddress', s.label, { shouldValidate: true });
                              setDestinationLocation({ lat: s.lat, lng: s.lng });
                              setShowSug(false);
                              try { fetch(`${API}/places/record`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ label: s.label }) }) } catch {}
                              if (currentLocation) calculateDistanceAndPrice(currentLocation, { lat: s.lat, lng: s.lng });
                            }}
                          >
                            <div className="text-sm text-gray-900">{s.label}</div>
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Vehicle Type and Passenger Count */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Araç Türü
                  </label>
                  <div className="relative">
                    <Car className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <select
                      {...register('vehicleType', {
                        required: 'Araç türü seçin',
                      })}
                      className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="sedan">🚗 Sedan</option>
                      <option value="suv">🚙 SUV</option>
                      <option value="van">🚐 Van</option>
                      <option value="luxury">🏎️ Lüks</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Yolcu Sayısı
                  </label>
                  <div className="relative">
                    <Users className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <select
                      {...register('passengerCount', {
                        required: 'Yolcu sayısını seçin',
                      })}
                      className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8].map((num) => (
                        <option key={num} value={num}>
                          {num}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Price and Distance Estimate */}
              {destinationLocation && (
                <div className="bg-blue-50 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-blue-900 mb-3">Tahmini Bilgiler</h3>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold text-blue-600">€{estimatedPrice}</p>
                      <p className="text-xs text-blue-700">Tutar (1€/km)</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-blue-600">{estimatedDistance} km</p>
                      <p className="text-xs text-blue-700">Mesafe</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-blue-600">{estimatedTime} dk</p>
                      <p className="text-xs text-blue-700">Süre</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Available Drivers */}
              {availableDrivers.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-gray-900">
                      Yakındaki Sürücüler ({availableDrivers.length})
                    </h3>
                  {/* Canlı takip etiketi kaldırıldı */}
                  </div>
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {availableDrivers.slice(0, 5).map((driver) => (
                      <DriverStatusCard
                        key={driver.id}
                        driver={driver}
                        customerLocation={currentLocation!}
                        onSelect={(driver) => setSelectedDriver(driver.id)}
                        isSelected={selectedDriver === driver.id}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full"
                disabled={!currentLocation || !destinationLocation}
              >
                <Car className="h-5 w-5 mr-2" />
                Hemen Araç Çağır
              </Button>
            </form>
          </div>
        </div>
      </div>
      {showRegister && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-30">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Hızlı Müşteri Kaydı</h3>
            <div className="space-y-3">
              <Input label="Ad Soyad" type="text" placeholder="Adınız" value={guestName} onChange={(e:any)=>setGuestName(e.target.value)} />
              <Input label="E-posta" type="email" placeholder="ornek@eposta.com" value={guestEmail} onChange={(e:any)=>setGuestEmail(e.target.value)} />
              <Input label="Telefon" type="tel" placeholder="05xx xxx xx xx" value={guestPhone} onChange={(e:any)=>setGuestPhone(e.target.value)} />
              <div className="flex gap-2">
                <Button className="flex-1" onClick={async ()=>{
                  try {
                    const payload = { name: guestName || 'Misafir', email: guestEmail || `guest_${Date.now()}@guest.local`, phone: guestPhone || '' };
                    const res = await fetch(`${API}/auth/register/customer`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                    const j = await res.json();
                    if (res.ok && j.success) {
                      toast.success('Müşteri kaydı oluşturuldu');
                      setShowRegister(false);
                      navigate(0);
                    } else {
                      toast.error('Kayıt başarısız');
                    }
                  } catch { toast.error('Kayıt hatası'); }
                }}>Kaydı Tamamla</Button>
                <Button variant="outline" onClick={()=>setShowRegister(false)}>Vazgeç</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
