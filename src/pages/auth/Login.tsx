import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { toast } from 'sonner';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';

interface LoginForm {
  email: string;
  password: string;
  userType: 'customer' | 'driver';
}

export const Login: React.FC = () => {
  const [showPassword, setShowPassword] = useState(false);
  const { login, isLoading } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  
  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>();

  const onSubmit = async (data: LoginForm) => {
    try {
      await login(data.email, data.password, data.userType);
      toast.success('Giriş başarılı!');
      
      // Redirect to intended page or dashboard
      const from = location.state?.from?.pathname;
      if (from) {
        navigate(from);
      } else if (data.userType === 'driver') {
        navigate('/driver/dashboard');
      } else {
        navigate('/customer/dashboard');
      }
    } catch (error) {
      toast.error('Giriş başarısız. Lütfen bilgilerinizi kontrol edin.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900">Hesabınıza giriş yapın</h2>
          <p className="mt-2 text-sm text-gray-600">
            Henüz hesabınız yok mu?{' '}
            <Link to="/register" className="font-medium text-blue-600 hover:text-blue-500">
              Hemen kayıt olun
            </Link>
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Kullanıcı Türü
              </label>
              <div className="grid grid-cols-2 gap-4">
                <label className="flex items-center">
                  <input
                    {...register('userType')}
                    type="radio"
                    value="customer"
                    defaultChecked
                    className="mr-2"
                  />
                  <span className="text-sm">Müşteri</span>
                </label>
                <label className="flex items-center">
                  <input
                    {...register('userType')}
                    type="radio"
                    value="driver"
                    className="mr-2"
                  />
                  <span className="text-sm">Sürücü</span>
                </label>
              </div>
            </div>

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

            <div>
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
              <div className="mt-2 text-right">
                <Link to="/forgot-password" className="text-sm text-blue-600 hover:text-blue-500">
                  Şifrenizi mi unuttunuz?
                </Link>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full"
              isLoading={isLoading}
            >
              Giriş Yap
            </Button>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">veya</span>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <Link to="/register" className="w-full">
                <Button variant="outline" className="w-full">
                  Müşteri Kaydı
                </Button>
              </Link>
              <Link to="/register/driver" className="w-full">
                <Button variant="outline" className="w-full">
                  Sürücü Kaydı
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};