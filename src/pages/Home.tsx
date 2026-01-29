import React from 'react';
import { ImmediateRideRequest } from '@/components/ImmediateRideRequest';
import { Button } from '@/components/ui/Button';
import { MapPin, Car, Users, Clock, Shield, Star, Navigation } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Home() {

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-blue-600 to-blue-800 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center mb-8">
            <h1 className="text-4xl md:text-6xl font-bold mb-4">
              Hemen Araç Çağır
            </h1>
            <p className="text-xl md:text-2xl text-blue-100 mb-8">
              Konumunuza en yakın sürücülerle anında transfer
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link to="/reserve">
                <Button size="lg" variant="secondary">Rezervasyon Yap</Button>
              </Link>
              <Link to="/reservations">
                <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10">Rezervasyonlarım</Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Immediate Ride Request */}
      <section className="py-8 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <ImmediateRideRequest />
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Nasıl Çalışır?
            </h2>
            <p className="text-lg text-gray-600">
              3 basit adımda hemen aracınız kapınızda
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="bg-blue-100 rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <span className="text-2xl font-bold text-blue-600">1</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Konumunuzu Belirleyin</h3>
              <p className="text-gray-600">
                GPS ile konumunuzu otomatik olarak belirleyin veya adresinizi manuel girin.
              </p>
            </div>
            <div className="text-center">
              <div className="bg-green-100 rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <span className="text-2xl font-bold text-green-600">2</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Sürücü Seçin</h3>
              <p className="text-gray-600">
                Yakınınızdaki sürücüleri görün, fiyat tekliflerini karşılaştırın ve pazarlık yapın.
              </p>
            </div>
            <div className="text-center">
              <div className="bg-orange-100 rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <span className="text-2xl font-bold text-orange-600">3</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Araç Kapınızda</h3>
              <p className="text-gray-600">
                Sürücüyü takip edin, tahmini varış süresini görün ve konforlu yolculuğun keyfini çıkarın.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="bg-blue-100 rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <MapPin className="h-8 w-8 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Canlı Konum</h3>
              <p className="text-sm text-gray-600">
                Sürücünüzün konumunu harita üzerinden canlı olarak takip edin.
              </p>
            </div>
            <div className="text-center">
              <div className="bg-green-100 rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <Clock className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Hızlı Varış</h3>
              <p className="text-sm text-gray-600">
                En yakın sürücülerle ortalama 5-10 dakikada varış.
              </p>
            </div>
            <div className="text-center">
              <div className="bg-orange-100 rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <Shield className="h-8 w-8 text-orange-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Güvenli</h3>
              <p className="text-sm text-gray-600">
                Onaylı sürücüler ve GPS takibi ile güvenli yolculuk.
              </p>
            </div>
            <div className="text-center">
              <div className="bg-purple-100 rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <Star className="h-8 w-8 text-purple-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Pazarlık</h3>
              <p className="text-sm text-gray-600">
                Sürücülerle doğrudan pazarlık yaparak en iyi fiyatı alın.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Real-time Tracking Demo kaldırıldı */}

      {/* CTA Section */}
      <section className="py-16 bg-blue-600 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold mb-4">
            Hemen Başlayın
          </h2>
          <p className="text-xl text-blue-100 mb-8">
            Bugün ilk yolculuğunuzu yapın ve konforlu transfer deneyimini yaşayın.
          </p>
          <Link to="/register">
            <Button size="lg" variant="secondary">
              Ücretsiz Kayıt Ol
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
