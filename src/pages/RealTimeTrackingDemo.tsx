import React, { useState, useEffect } from 'react';
import { Map } from '@/components/Map';
import { DriverStatusCard } from '@/components/DriverStatusCard';
import { useBookingStore } from '@/stores/bookingStore';
import { Navigation, RefreshCw, MapPin, Car } from 'lucide-react';
import { toast } from 'sonner';

export const RealTimeTrackingDemo: React.FC = () => {
  const { availableDrivers, refreshApprovedDriversNear, startRealTimeUpdates } = useBookingStore();
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedDriver, setSelectedDriver] = useState<string | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  // Demo location (Istanbul center)
  const demoLocation = { lat: 41.0082, lng: 28.9784 };

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
          toast.success('Konumunuz bulundu!');
          
          refreshApprovedDriversNear(location);
          startRealTimeUpdates();
        },
        (error) => {
          setIsLocating(false);
          toast.error('Konumunuz alınamadı. Demo konum kullanılıyor.');
          setCurrentLocation(demoLocation);
          refreshApprovedDriversNear(demoLocation);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000,
        }
      );
    } else {
      setIsLocating(false);
      toast.error('Tarayıcınız konum özelliğini desteklemiyor. Demo konum kullanılıyor.');
      setCurrentLocation(demoLocation);
      refreshApprovedDriversNear(demoLocation);
    }
  };

  const startRealTimeTracking = () => {
    if (!currentLocation) {
      toast.error('Lütfen önce konumunuzu belirleyin');
      return;
    }

    setIsTracking(true);
    toast.success('Canlı takip başlatıldı!');

    // Start real-time updates
    const interval = setInterval(() => {
      // Güncellemeler store içindeki startRealTimeUpdates ile yönetiliyor
    }, 2000);

    // Stop tracking after 30 seconds
    setTimeout(() => {
      clearInterval(interval);
      setIsTracking(false);
      toast.info('Canlı takip durduruldu');
    }, 30000);

    return () => clearInterval(interval);
  };

  useEffect(() => {
    getCurrentLocation();
  }, []);

  const availableDriversFiltered = availableDrivers.filter(driver => driver.isAvailable);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Canlı Sürücü Takip Sistemi
          </h1>
          <p className="text-gray-600">
            Gerçek zamanlı olarak yakındaki sürücüleri görün ve konumlarını canlı olarak takip edin
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Map Section */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="p-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900">
                    Harita Görünümü
                  </h2>
                  <div className="flex items-center space-x-2">
                    {isTracking && (
                      <div className="flex items-center text-green-600 text-sm">
                        <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                        Canlı Takip Aktif
                      </div>
                    )}
                    <button
                      onClick={getCurrentLocation}
                      disabled={isLocating}
                      className="flex items-center px-3 py-1 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50"
                    >
                      <Navigation className="h-4 w-4 mr-1" />
                      {isLocating ? 'Konum Aranıyor...' : 'Konumum'}
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="h-96 lg:h-96">
                {currentLocation ? (
                  <Map
                    center={currentLocation}
                    customerLocation={currentLocation}
                    drivers={availableDriversFiltered}
                    onDriverClick={(driver) => setSelectedDriver(driver.id)}
                    zoom={14}
                  />
                ) : (
                  <div className="h-full flex items-center justify-center bg-gray-100">
                    <div className="text-center">
                      <MapPin className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600 mb-4">Harita yükleniyor...</p>
                      <button
                        onClick={getCurrentLocation}
                        disabled={isLocating}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                      >
                        {isLocating ? 'Konum Aranıyor...' : 'Konumumu Bul'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Driver List Section */}
          <div className="space-y-4">
            <div className="bg-white rounded-lg shadow-md p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  Yakındaki Sürücüler
                </h2>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">
                    {availableDriversFiltered.length} aktif
                  </span>
                  {!isTracking && currentLocation && (
                    <button
                      onClick={startRealTimeTracking}
                      className="flex items-center px-3 py-1 bg-green-600 text-white rounded-md text-sm hover:bg-green-700"
                    >
                      <RefreshCw className="h-4 w-4 mr-1" />
                      Takip Başlat
                    </button>
                  )}
                </div>
              </div>

              {availableDriversFiltered.length > 0 ? (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {availableDriversFiltered.map((driver) => (
                    <DriverStatusCard
                      key={driver.id}
                      driver={driver}
                      customerLocation={currentLocation!}
                      onSelect={(driver) => setSelectedDriver(driver.id)}
                      isSelected={selectedDriver === driver.id}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Car className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600">Müsait sürücü bulunamadı</p>
                  <p className="text-sm text-gray-500 mt-1">
                    Konumunuzu kontrol edin veya başka bir bölge deneyin
                  </p>
                </div>
              )}
            </div>

            {/* System Info */}
            <div className="bg-white rounded-lg shadow-md p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                Sistem Bilgileri
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Toplam Sürücü:</span>
                  <span className="font-medium">{availableDrivers.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Müsait Sürücü:</span>
                  <span className="font-medium text-green-600">{availableDriversFiltered.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Canlı Takip:</span>
                  <span className={`font-medium ${isTracking ? 'text-green-600' : 'text-gray-500'}`}>
                    {isTracking ? 'Aktif' : 'Pasif'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Güncelleme:</span>
                  <span className="font-medium text-blue-600">2 saniye</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
