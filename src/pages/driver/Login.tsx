import React from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { toast } from 'sonner'

interface LoginForm {
  email: string
  password: string
}

export const DriverLogin: React.FC = () => {
  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>()
  const { login, isLoading } = useAuthStore()
  const navigate = useNavigate()

  const onSubmit = async (data: LoginForm) => {
    try {
      await login(data.email, data.password, 'driver')
      toast.success('Sürücü girişi başarılı')
      navigate('/driver/dashboard')
    } catch {
      toast.error('Giriş başarısız. Bilgilerinizi kontrol edin')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900">Sürücü Girişi</h2>
          <p className="mt-2 text-sm text-gray-600">Sürücü paneline erişmek için giriş yapın</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <Input
              label="E-posta"
              type="email"
              placeholder="E-posta adresiniz"
              {...register('email', {
                required: 'E-posta gerekli',
                pattern: { value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i, message: 'Geçerli e-posta girin' }
              })}
              error={errors.email?.message}
            />
            <Input
              label="Şifre"
              type="password"
              placeholder="Şifreniz"
              {...register('password', { required: 'Şifre gerekli', minLength: { value: 6, message: 'En az 6 karakter' } })}
              error={errors.password?.message}
            />
            <Button type="submit" className="w-full" isLoading={isLoading}>Giriş Yap</Button>
          </form>
        </div>
      </div>
    </div>
  )
}
