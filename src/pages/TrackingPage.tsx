import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import { Map } from '@/components/Map';
import { Button } from '@/components/ui/Button';
import { useBookingStore } from '@/stores/bookingStore';
import { useAuthStore } from '@/stores/authStore';
import { MapPin, Phone, Clock, Car, User, MessageCircle, CheckCircle, XCircle, Star, Navigation } from 'lucide-react';
import { toast } from 'sonner';

export const TrackingPage: React.FC = () => {
  const navigate = useNavigate();
  const { bookingId } = useParams();
  const { user } = useAuthStore();
  const { currentBooking, updateBookingStatus, refreshBookingById } = useBookingStore();
  
  const [driverLocation, setDriverLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [estimatedArrival, setEstimatedArrival] = useState<number>(5);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<string>('accepted');
  const [showChat, setShowChat] = useState(false);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Array<{id: string, sender: string, text: string, time: string}>>([]);
  const [routePath, setRoutePath] = useState<Array<{lat:number,lng:number}>>([]);
  const [remainingPath, setRemainingPath] = useState<Array<{lat:number,lng:number}>>([]);
  const [driverInfo, setDriverInfo] = useState<any>(null);
  const notifiedRef = useRef(false);

  const booking = currentBooking;

  // Real-time Driver Tracking via Socket
  useEffect(() => {
    if (!booking?.driverId) return;

    const origin = (import.meta.env.VITE_API_ORIGIN as string) || `http://${window.location.hostname}:3005`;
    const socket = io(origin, { transports: ['websocket'], reconnection: true });

    socket.on('connect', () => {
      // Optional: Join a room if backend supports it
    });

    socket.on('driver:update', (data: any) => {
      if (data.id === booking.driverId && data.location) {
        setDriverLocation(data.location);
        
        // Update ETA and Check Proximity
        if (booking.pickupLocation) {
           const R = 6371; // Radius of the earth in km
           const dLat = (booking.pickupLocation.lat - data.location.lat) * (Math.PI/180);
           const dLng = (booking.pickupLocation.lng - data.location.lng) * (Math.PI/180);
           const a = 
             Math.sin(dLat/2) * Math.sin(dLat/2) +
             Math.cos(data.location.lat * (Math.PI/180)) * Math.cos(booking.pickupLocation.lat * (Math.PI/180)) * 
             Math.sin(dLng/2) * Math.sin(dLng/2);
           const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
           const d = R * c; // Distance in km
           
           const newEta = Math.max(1, Math.round((d / 40) * 60)); // Assumes 40km/h avg speed
           setEstimatedArrival(newEta);

           // Proximity Alert (< 500m)
           if (d < 0.5 && status === 'driver_en_route' && !notifiedRef.current) {
             toast.info('Sürücünüz yaklaşıyor! (500m)', { duration: 5000 });
             notifiedRef.current = true;
           }
        }
      }
    });

    return () => { socket.disconnect(); };
  }, [booking?.driverId, booking?.pickupLocation, status]);

  useEffect(() => {
    if (!booking && bookingId) {
      refreshBookingById(bookingId);
    }
  }, [bookingId]);

  useEffect(() => {
    // Status Update Notification
  useEffect(() => {
    if (!status) return;
    if (status === 'driver_en_route') toast.success('Sürücünüz yola çıktı!');
    if (status === 'driver_arrived') toast.success('Sürücünüz konumunuza vardı!');
    if (status === 'in_progress') toast.info('Yolculuk başladı.');
    if (status === 'completed') toast.success('Yolculuk tamamlandı.');
  }, [status]);

  if (!booking) {
      toast.error('Aktif rezervasyon bulunamadı');
      navigate('/');
      return;
    }
    setStatus(booking.status);
    
    // Initial Driver Info Fetch
    const fetchDriver = async () => {
        if (booking.driverId && !driverInfo) {
            try {
                const res = await fetch(`/api/drivers/${booking.driverId}`);
                const j = await res.json();
                if (res.ok && j.success && j.data) {
                    setDriverInfo(j.data);
                    if (j.data.location && !driverLocation) {
                        setDriverLocation(j.data.location);
                    }
                }
            } catch {}
        }
    };
    fetchDriver();

  }, [booking, navigate]);

  // Robust Route Fetching
  useEffect(() => {
    if (!driverLocation || !booking?.pickupLocation || routePath.length > 0) return;

    const fetchRoute = async (retries = 3) => {
        try {
            const url = `https://router.project-osrm.org/route/v1/driving/${driverLocation.lng},${driverLocation.lat};${booking.pickupLocation.lng},${booking.pickupLocation.lat}?overview=full&geometries=geojson`;
            const res = await fetch(url);
            if (!res.ok) throw new Error('Network response was not ok');
            
            const rj = await res.json();
            if (rj.code !== 'Ok') throw new Error('OSRM Error');

            const coords = Array.isArray(rj.routes) && rj.routes[0]?.geometry?.coordinates ? rj.routes[0].geometry.coordinates : [];
            const mapped = coords.map((c:any)=>({ lat: c[1], lng: c[0] }));
            const path = mapped.length > 1 ? mapped : [driverLocation, booking.pickupLocation];
            
            setRoutePath(path);
            setRemainingPath(path);
            
            const durSec = rj.routes?.[0]?.duration;
            if (typeof durSec === 'number' && isFinite(durSec)) {
                setEstimatedArrival(Math.max(1, Math.round(durSec / 60)));
            }
        } catch (err) {
            if (retries > 0) {
                setTimeout(() => fetchRoute(retries - 1), 2000);
            } else {
                // Fallback: Straight line
                const path = [driverLocation, booking.pickupLocation];
                setRoutePath(path);
                setRemainingPath(path);
            }
        }
    };
    
    fetchRoute();
  }, [driverLocation, booking?.pickupLocation]);

  // Update Remaining Path as Driver Moves
  useEffect(() => {
    if (driverLocation && routePath.length > 0) {
        const idx = routePath.reduce((best:number, p, i)=>{
            const bd = Math.hypot(routePath[best].lat - driverLocation.lat, routePath[best].lng - driverLocation.lng);
            const cd = Math.hypot(p.lat - driverLocation.lat, p.lng - driverLocation.lng);
            return cd < bd ? i : best;
        }, 0);
        setRemainingPath(routePath.slice(idx));
    }
  }, [driverLocation]);

  useEffect(() => {
    if (booking?.pickupLocation && !driverLocation) {
      setDriverLocation({
        lat: booking.pickupLocation.lat + 0.02,
        lng: booking.pickupLocation.lng + 0.02,
      });
    }
  }, [booking]);

  const getStatusText = () => {
    switch (status) {
      case 'accepted': return 'Sürücü Kabul Etti';
      case 'driver_en_route': return 'Sürücü Yolda';
      case 'driver_arrived': return 'Sürücü Varış Noktasında';
      case 'in_progress': return 'Yolculuk Devam Ediyor';
      case 'completed': return 'Yolculuk Tamamlandı';
      default: return 'Bekleniyor';
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'accepted': return 'bg-blue-100 text-blue-800';
      case 'driver_en_route': return 'bg-yellow-100 text-yellow-800';
      case 'driver_arrived': return 'bg-green-100 text-green-800';
      case 'in_progress': return 'bg-purple-100 text-purple-800';
      case 'completed': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleSendMessage = () => {
    if (message.trim()) {
      const newMessage = {
        id: Date.now().toString(),
        sender: 'customer',
        text: message,
        time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, newMessage]);
      setMessage('');
      toast.success('Mesaj gönderildi');
      
      setTimeout(() => {
        const driverResponse = {
          id: (Date.now() + 1).toString(),
          sender: 'driver',
          text: 'Mesajınız alındı, birazdan varacağım.',
          time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
        };
        setMessages(prev => [...prev, driverResponse]);
      }, 2000);
    }
  };

  const handleCancelRide = async () => {
    if (window.confirm('Yolculuğu iptal etmek istediğinize emin misiniz?')) {
      setIsLoading(true);
      try {
        await updateBookingStatus(booking?.id || '', 'cancelled');
        toast.success('Yolculuk iptal edildi');
        navigate('/customer/dashboard');
      } catch (error) {
        toast.error('İptal işlemi başarısız oldu');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleCompleteRide = async () => {
    setIsLoading(true);
    try {
      await updateBookingStatus(booking?.id || '', 'completed');
      try {
        await fetch(`/api/bookings/${booking?.id}/pay`, { 
          method:'POST', 
          headers:{'Content-Type':'application/json'}, 
          body: JSON.stringify({ amount: booking?.finalPrice || booking?.basePrice || 0 }) 
        })
      } catch {}
      toast.success('Yolculuk tamamlandı');
      navigate('/customer/dashboard');
    } catch (error) {
      toast.error('İşlem başarısız oldu');
    } finally {
      setIsLoading(false);
    }
  };

  if (!booking) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center bg-white rounded-xl shadow-lg p-8 max-w-md">
          <Car className="h-20 w-20 text-gray-300 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Aktif rezervasyon bulunamadı</h2>
          <p className="text-gray-600 mb-6">Yeni bir rezervasyon oluşturmak için ana sayfaya dönün.</p>
          <Button onClick={() => navigate('/')}>Ana Sayfaya Dön</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Yolculuk Takibi</h1>
          <p className="text-gray-600">Sürücünüzün konumunu canlı olarak takip edin</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Side - Map */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-lg overflow-hidden" style={{ height: '600px' }}>
              {booking.pickupLocation && driverLocation ? (
                <Map
                  center={booking.pickupLocation}
                  customerLocation={booking.pickupLocation}
                  destination={booking.dropoffLocation}
                  drivers={[{
                    id: booking.driverId || '',
                    name: driverInfo?.name || 'Sürücünüz',
                    email: '',
                    phone: '',
                    role: 'driver',
                    isVerified: true,
                    createdAt: '',
                    updatedAt: '',
                    licenseNumber: '',
                    vehicleType: 'sedan',
                    vehicleModel: driverInfo?.vehicleModel || 'Araç',
                    licensePlate: driverInfo?.licensePlate || '',
                    rating: 4.8,
                    totalRides: 100,
                    isAvailable: false,
                    currentLocation: driverLocation,
                    lastLocationUpdate: new Date().toISOString(),
                  }]}
                  showRoute={false}
                  path={remainingPath.length>1 ? remainingPath : (Array.isArray(booking.route?.driverPath) ? booking.route!.driverPath : undefined)}
                />
              ) : (
                <div className="h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
                  <div className="text-center">
                    <Car className="h-20 w-20 text-gray-400 mx-auto mb-4 animate-pulse" />
                    <p className="text-gray-600 font-medium">Harita yükleniyor...</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Side - Info */}
          <div className="space-y-6">
            {/* Status Card */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <Clock className="h-5 w-5 mr-2 text-blue-600" />
                  Durum
                </h3>
                <span className={`px-4 py-2 rounded-full text-sm font-medium ${getStatusColor()}`}>
                  {getStatusText()}
                </span>
              </div>
              
              {status !== 'completed' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg">
                    <div className="flex items-center">
                      <Clock className="h-5 w-5 text-blue-600 mr-2" />
                      <span className="text-sm text-gray-700">Tahmini Varış</span>
                    </div>
                    <span className="font-bold text-blue-600">{estimatedArrival} dk</span>
                  </div>
                  
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div 
                      className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all duration-1000"
                      style={{ width: `${Math.max(10, 100 - (estimatedArrival * 5))}%` }}
                    ></div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mt-4">
                    <Button variant="outline" size="sm" className="w-full">
                      <Phone className="h-4 w-4 mr-1" />
                      Ara
                    </Button>
                    <Button variant="outline" size="sm" className="w-full" onClick={() => setShowChat(!showChat)}>
                      <MessageCircle className="h-4 w-4 mr-1" />
                      Mesaj
                    </Button>
                  </div>
                </div>
              )}

              {status === 'completed' && (
                <div className="text-center py-6">
                  <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-3" />
                  <p className="text-lg font-semibold text-gray-900">Yolculuk Tamamlandı!</p>
                  <p className="text-sm text-gray-600 mt-1">Teşekkürler, iyi yolculuklar 🚗</p>
                </div>
              )}
            </div>

            {/* Driver Info */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <User className="h-5 w-5 mr-2 text-blue-600" />
                Sürücü Bilgileri
              </h3>
              <div className="flex items-center mb-4">
                <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-full p-4 mr-4">
                  <User className="h-10 w-10 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{driverInfo?.name || 'Ahmet Yılmaz'}</p>
                  <p className="text-sm text-gray-600">{driverInfo?.vehicleModel || 'Toyota Camry'}</p>
                  <p className="text-sm text-gray-500">{driverInfo?.licensePlate || '34 ABC 123'}</p>
                  <div className="flex items-center mt-1">
                    <Star className="h-4 w-4 text-yellow-400 fill-current mr-1" />
                    <span className="text-sm text-gray-600">4.8 (125 yolculuk)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Trip Details */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Navigation className="h-5 w-5 mr-2 text-blue-600" />
                Yolculuk Detayları
              </h3>
              <div className="space-y-4">
                <div className="flex items-start p-3 bg-green-50 rounded-lg">
                  <MapPin className="h-5 w-5 text-green-500 mr-3 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Alış Noktası</p>
                    <p className="text-sm text-gray-600 mt-1">{booking.pickupLocation.address}</p>
                  </div>
                </div>
                <div className="flex items-start p-3 bg-red-50 rounded-lg">
                  <MapPin className="h-5 w-5 text-red-500 mr-3 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Varış Noktası</p>
                    <p className="text-sm text-gray-600 mt-1">{booking.dropoffLocation.address}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border-2 border-gray-200">
                  <span className="text-sm font-medium text-gray-700">Tutar</span>
                  <span className="text-xl font-bold text-gray-900">₺{(booking.finalPrice || booking.basePrice).toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            {status !== 'completed' && (
              <div className="space-y-3">
                {status === 'in_progress' && (
                  <Button className="w-full" onClick={handleCompleteRide} disabled={isLoading}>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Yolculuğu Tamamla
                  </Button>
                )}
                <Button variant="outline" className="w-full text-red-600 border-red-300 hover:bg-red-50" onClick={handleCancelRide} disabled={isLoading}>
                  <XCircle className="h-4 w-4 mr-2" />
                  Yolculuğu İptal Et
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Chat Modal */}
        {showChat && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end lg:items-center justify-center z-50" onClick={() => setShowChat(false)}>
            <div className="bg-white w-full lg:max-w-md max-h-[80vh] lg:rounded-xl rounded-t-xl flex flex-col" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-blue-500 to-blue-600">
                <h4 className="font-semibold text-white">Sürücü ile Mesajlaş</h4>
                <Button variant="ghost" size="sm" onClick={() => setShowChat(false)} className="text-white hover:bg-blue-700">
                  Kapat
                </Button>
              </div>
              <div className="p-4 space-y-3 flex-1 overflow-y-auto">
                {messages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.sender === 'customer' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-xs px-4 py-3 rounded-2xl ${
                      msg.sender === 'customer' 
                        ? 'bg-blue-500 text-white' 
                        : 'bg-gray-100 text-gray-900'
                    }`}>
                      <p className="text-sm">{msg.text}</p>
                      <p className="text-xs opacity-70 mt-1">{msg.time}</p>
                    </div>
                  </div>
                ))}
                {messages.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <MessageCircle className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm">Henüz mesaj yok</p>
                  </div>
                )}
              </div>
              <div className="p-4 border-t bg-gray-50">
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Mesaj yazın..."
                    className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  />
                  <Button size="sm" onClick={handleSendMessage}>
                    Gönder
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
