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
}

export const Login: React.FC = () => {
  const [showPassword, setShowPassword] = useState(false);
  const { login, isLoading } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  
  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>();

  const onSubmit = async (data: LoginForm) => {
    try {
      let emailInput = (data.email || '').trim().toLowerCase()
      if (emailInput === 'admin@gettrasfer.com' || emailInput === 'admin@gettranfer.com' || emailInput === 'admin@gettransfer.co') {
        emailInput = 'admin@gettransfer.com'
        toast.info('admin@gettransfer.com olarak düzeltildi')
      }
      const desiredType = (emailInput === 'admin' || emailInput === 'admin@gettransfer.com') ? 'admin' : 'customer'
      await login(emailInput, data.password, desiredType);
      toast.success('Giriş başarılı!');
      
      // Redirect to intended page or dashboard
      const from = location.state?.from?.pathname;
      if (from) {
        navigate(from);
      } else {
        const role = useAuthStore.getState().user?.role
        if (role === 'admin') navigate('/admin/drivers')
        else navigate('/customer/dashboard');
      }
    } catch (error) {
      toast.error('Giriş başarısız. Lütfen bilgilerinizi kontrol edin.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900">Müşteri Girişi</h2>
          <p className="mt-2 text-sm text-gray-600">
            Henüz hesabınız yok mu?{' '}
            <Link to="/register" className="font-medium text-blue-600 hover:text-blue-500">
              Hemen kayıt olun
            </Link>
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

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

            {/* Google ile Giriş */}
            <div className="mt-6">
              <button
                type="button"
                onClick={() => {
                  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
                  if (!googleClientId) {
                    toast.error('Google giriş yapılandırılmamış');
                    return;
                  }
                  
                  // Google OAuth redirect
                  const redirectUri = encodeURIComponent(window.location.origin + '/auth/callback');
                  const scope = encodeURIComponent('email profile');
                  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${googleClientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}`;
                  window.location.href = authUrl;
                }}
                className="w-full flex items-center justify-center gap-3 bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Google ile Giriş Yap
              </button>
            </div>

            <div className="mt-4">
              <Link to="/register" className="w-full">
                <Button variant="outline" className="w-full">
                  Müşteri Kaydı
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
