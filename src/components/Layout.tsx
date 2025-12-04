import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/Button';
import { 
  Car, 
  MapPin, 
  User, 
  Menu, 
  X,
  LogOut,
  Settings,
  History
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, logout } = useAuthStore();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);

  const isActive = (path: string) => location.pathname === path;

  const navigation = [
    { name: 'Ana Sayfa', href: '/', icon: Car },
    { name: 'Ara', href: '/search', icon: MapPin },
  ];

  const customerNavigation = [
    { name: 'Rezervasyonlarım', href: '/customer/dashboard', icon: History },
    { name: 'Profil', href: '/profile', icon: User },
  ];

  const driverNavigation = [
    { name: 'Sürücü Paneli', href: '/driver/dashboard', icon: Car },
    { name: 'Dokümanlar', href: '/driver/documents', icon: Settings },
    { name: 'Profil', href: '/profile', icon: User },
  ];

  const getUserNavigation = () => {
    if (!user) return [];
    if (user.role === 'driver') return driverNavigation;
    return customerNavigation;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center space-x-2">
              <Car className="h-8 w-8 text-blue-600" />
              <span className="text-xl font-bold text-gray-900">GetTransfer</span>
              <span className="text-xs text-gray-500">Build: {typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : ''}</span>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-8">
              {navigation.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive(item.href)
                        ? 'bg-blue-100 text-blue-700'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </div>

            {/* User Menu */}
            <div className="hidden md:flex items-center space-x-4">
              {user ? (
                <div className="flex items-center space-x-4">
                  {getUserNavigation().map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.name}
                        to={item.href}
                        className={`flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                          isActive(item.href)
                            ? 'bg-blue-100 text-blue-700'
                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        <span>{item.name}</span>
                      </Link>
                    );
                  })}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={logout}
                    className="text-gray-600 hover:text-gray-900"
                  >
                    <LogOut className="h-4 w-4 mr-1" />
                    Çıkış
                  </Button>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <Link to="/driver/login">
                    <Button variant="outline" size="sm">
                      Sürücü Girişi
                    </Button>
                  </Link>
                  <Link to="/login">
                    <Button variant="outline" size="sm">
                      Giriş Yap
                    </Button>
                  </Link>
                  <Link to="/register">
                    <Button size="sm">
                      Kayıt Ol
                    </Button>
                  </Link>
                </div>
              )}
            </div>

            {/* Mobile menu button */}
            <div className="md:hidden">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
              >
                {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden bg-white border-t">
            <div className="px-2 pt-2 pb-3 space-y-1">
              {navigation.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`flex items-center space-x-2 px-3 py-2 rounded-md text-base font-medium transition-colors ${
                      isActive(item.href)
                        ? 'bg-blue-100 text-blue-700'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    }`}
                    onClick={() => setIsMenuOpen(false)}
                  >
                    <Icon className="h-5 w-5" />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
              
              {user && getUserNavigation().map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`flex items-center space-x-2 px-3 py-2 rounded-md text-base font-medium transition-colors ${
                      isActive(item.href)
                        ? 'bg-blue-100 text-blue-700'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    }`}
                    onClick={() => setIsMenuOpen(false)}
                  >
                    <Icon className="h-5 w-5" />
                    <span>{item.name}</span>
                  </Link>
                );
              })}

              {user && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    logout();
                    setIsMenuOpen(false);
                  }}
                  className="w-full justify-start text-gray-600 hover:text-gray-900"
                >
                  <LogOut className="h-5 w-5 mr-2" />
                  Çıkış Yap
                </Button>
              )}
            </div>
            
            {!user && (
              <div className="px-2 py-3 space-y-2 border-t">
                <Link to="/driver/login" onClick={() => setIsMenuOpen(false)}>
                  <Button variant="outline" className="w-full">
                    Sürücü Girişi
                  </Button>
                </Link>
                <Link to="/login" onClick={() => setIsMenuOpen(false)}>
                  <Button variant="outline" className="w-full">
                    Giriş Yap
                  </Button>
                </Link>
                <Link to="/register" onClick={() => setIsMenuOpen(false)}>
                  <Button className="w-full">
                    Kayıt Ol
                  </Button>
                </Link>
              </div>
            )}
          </div>
        )}
      </nav>

      {/* Main Content */}
      <main className="flex-1">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <Car className="h-8 w-8 text-blue-400" />
                <span className="text-xl font-bold">GetTransfer</span>
              </div>
              <p className="text-gray-400">
                Güvenilir ve konforlu transfer hizmetleri için tek adresiniz.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-4">Müşteriler</h3>
              <ul className="space-y-2 text-gray-400">
                <li><Link to="/search" className="hover:text-white transition-colors">Transfer Ara</Link></li>
                <li><Link to="/customer/dashboard" className="hover:text-white transition-colors">Rezervasyonlarım</Link></li>
                <li><Link to="/register" className="hover:text-white transition-colors">Kayıt Ol</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-4">Sürücüler</h3>
              <ul className="space-y-2 text-gray-400">
                <li><Link to="/register/driver" className="hover:text-white transition-colors">Sürücü Ol</Link></li>
                <li><Link to="/driver/dashboard" className="hover:text-white transition-colors">Sürücü Paneli</Link></li>
                <li><Link to="/driver/documents" className="hover:text-white transition-colors">Dokümanlar</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-4">Yardım</h3>
              <ul className="space-y-2 text-gray-400">
                <li><Link to="/help" className="hover:text-white transition-colors">Yardım Merkezi</Link></li>
                <li><Link to="/contact" className="hover:text-white transition-colors">İletişim</Link></li>
                <li><Link to="/terms" className="hover:text-white transition-colors">Şartlar ve Koşullar</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
            <p>&copy; 2024 GetTransfer. Tüm hakları saklıdır.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};
