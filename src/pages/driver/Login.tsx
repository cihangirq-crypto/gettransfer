import React from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
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
      let emailInput = (data.email || '').trim().toLowerCase()
      if (emailInput === 'admin@gettrasfer.com' || emailInput === 'admin@gettranfer.com' || emailInput === 'admin@gettransfer.co') {
        emailInput = 'admin@gettransfer.com'
        toast.info('admin@gettransfer.com olarak düzeltildi')
      }
      const isAdmin = (emailInput === 'admin' || emailInput === 'admin@gettransfer.com') && data.password === '12345678'
      if (isAdmin) {
        await login(emailInput, data.password, 'admin')
        toast.success('Admin girişi başarılı')
        navigate('/admin/drivers')
      } else {
        const res = await fetch('/api/drivers/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: emailInput, password: data.password }) })
        const j = await res.json()
        if (!res.ok || !j.success) throw new Error('invalid_credentials')
        // auth store içine driver user yaz
        useAuthStore.getState().setUser({ id: j.data.id, email: emailInput, name: 'Sürücü', phone: '', role: 'driver', isVerified: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
        useAuthStore.getState().setTokens('mock-token', 'mock-refresh')
        toast.success('Sürücü girişi başarılı')
        navigate('/driver/dashboard')
      }
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
              label="Kullanıcı adı veya E-posta"
              type="text"
              placeholder="admin veya e-posta"
              {...register('email', {
                required: 'Kullanıcı adı veya e-posta gerekli',
                validate: (v) => ((v === 'admin' || v === 'admin@gettransfer.com') || /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(v)) || 'Geçerli e-posta veya admin'
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
          <div className="mt-4 space-y-3">
            <Link to="/driver/apply" className="w-full">
              <Button variant="outline" className="w-full">Yeni Sürücü Başvurusu</Button>
            </Link>
            <p className="text-xs text-gray-500 text-center">Admin: admin@gettransfer.com (veya admin) • Şifre: 12345678</p>
          </div>
        </div>
      </div>
    </div>
  )
}
