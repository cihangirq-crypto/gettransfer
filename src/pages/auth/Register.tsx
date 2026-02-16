import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { toast } from 'sonner';
import { Mail, Lock, User, Phone, Eye, EyeOff, Car } from 'lucide-react';

interface RegisterForm {
  name: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  // Driver specific fields
  licenseNumber?: string;
  vehicleType?: 'sedan' | 'suv' | 'van' | 'luxury';
  vehicleModel?: string;
  vehiclePlate?: string;
}

interface RegisterProps {
  isDriver?: boolean;
}

export const Register: React.FC<RegisterProps> = ({ isDriver = false }) => {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { register: registerUser, isLoading } = useAuthStore();
  const navigate = useNavigate();
  
  const { register, handleSubmit, watch, formState: { errors } } = useForm<RegisterForm>();
  const password = watch('password');

  const onSubmit = async (data: RegisterForm) => {
    try {
      const userData = {
        name: data.name,
        email: data.email,
        phone: data.phone,
        password: data.password,
        ...(isDriver && {
          licenseNumber: data.licenseNumber,
          vehicleType: data.vehicleType,
          vehicleModel: data.vehicleModel,
          vehiclePlate: data.vehiclePlate,
        }),
      };

      await registerUser(userData, isDriver ? 'driver' : 'customer');
      toast.success('Kayıt başarılı! Giriş yapabilirsiniz.');
      navigate(isDriver ? '/driver/dashboard' : '/customer/dashboard');
    } catch (error) {
      toast.error('Kayıt başarısız. Lütfen bilgilerinizi kontrol edin.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="flex items-center justify-center mb-4">
            {isDriver ? (
              <Car className="h-12 w-12 text-blue-600" />
            ) : (
              <User className="h-12 w-12 text-blue-600" />
            )}
          </div>
          <h2 className="text-3xl font-bold text-gray-900">
            {isDriver ? 'Sürücü Kaydı' : 'Müşteri Kaydı'}
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Zaten hesabınız var mı?{' '}
            <Link to="/login" className="font-medium text-blue-600 hover:text-blue-500">
              Giriş yapın
            </Link>
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <Input
              label="Ad Soyad"
              type="text"
              placeholder="Adınız ve soyadınız"
              leftIcon={<User className="h-5 w-5 text-gray-400" />}
              {...register('name', {
                required: 'Ad soyad gereklidir',
                minLength: {
                  value: 3,
                  message: 'Ad soyad en az 3 karakter olmalıdır',
                },
              })}
              error={errors.name?.message}
            />

            <Input
              label="E-posta adresi"
              type="email"
              placeholder="E-posta adresinizi girin"
              leftIcon={<Mail className="h-5 w-5 text-gray-400" />}
              {...register('email', {
                required: 'E-posta adresi gereklidir',
                pattern: {
                  value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                  message: 'Geçerli bir e-posta adresi girin',
                },
              })}
              error={errors.email?.message}
            />

            <Input
              label="Telefon numarası"
              type="tel"
              placeholder="Telefon numaranızı girin"
              leftIcon={<Phone className="h-5 w-5 text-gray-400" />}
              {...register('phone', {
                required: 'Telefon numarası gereklidir',
                pattern: {
                  value: /^[\+]?[\d\s\-\(\)]+$/,
                  message: 'Geçerli bir telefon numarası girin',
                },
              })}
              error={errors.phone?.message}
            />

            <Input
              label="Şifre"
              type={showPassword ? 'text' : 'password'}
              placeholder="Şifrenizi girin"
              leftIcon={<Lock className="h-5 w-5 text-gray-400" />}
              rightIcon={
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              }
              {...register('password', {
                required: 'Şifre gereklidir',
                minLength: {
                  value: 6,
                  message: 'Şifre en az 6 karakter olmalıdır',
                },
              })}
              error={errors.password?.message}
            />

            <Input
              label="Şifre Tekrar"
              type={showConfirmPassword ? 'text' : 'password'}
              placeholder="Şifrenizi tekrar girin"
              leftIcon={<Lock className="h-5 w-5 text-gray-400" />}
              rightIcon={
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              }
              {...register('confirmPassword', {
                required: 'Şifre tekrarı gereklidir',
                validate: value => value === password || 'Şifreler eşleşmiyor',
              })}
              error={errors.confirmPassword?.message}
            />

            {isDriver && (
              <>
                <div className="border-t pt-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Araç Bilgileri</h3>
                </div>

                <Input
                  label="Ehliyet Numarası"
                  type="text"
                  placeholder="Ehliyet numaranız"
                  {...register('licenseNumber', {
                    required: 'Ehliyet numarası gereklidir',
                  })}
                  error={errors.licenseNumber?.message}
                />

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Araç Türü
                  </label>
                  <select
                    {...register('vehicleType', {
                      required: 'Araç türü gereklidir',
                    })}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  >
                    <option value="">Araç türü seçin</option>
                    <option value="sedan">Sedan</option>
                    <option value="suv">SUV</option>
                    <option value="van">Van</option>
                    <option value="luxury">Lüks</option>
                  </select>
                  {errors.vehicleType && (
                    <p className="mt-1 text-sm text-red-600">{errors.vehicleType.message}</p>
                  )}
                </div>

                <Input
                  label="Araç Modeli"
                  type="text"
                  placeholder="Örn: Toyota Camry 2020"
                  {...register('vehicleModel', {
                    required: 'Araç modeli gereklidir',
                  })}
                  error={errors.vehicleModel?.message}
                />

                <Input
                  label="Araç Plakası"
                  type="text"
                  placeholder="34 ABC 123"
                  {...register('vehiclePlate', {
                    required: 'Araç plakası gereklidir',
                  })}
                  error={errors.vehiclePlate?.message}
                />
              </>
            )}

            <Button
              type="submit"
              className="w-full"
              isLoading={isLoading}
            >
              {isDriver ? 'Sürücü Olarak Kayıt Ol' : 'Müşteri Olarak Kayıt Ol'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};