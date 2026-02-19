import React from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useDriverStore } from '@/stores/driverStore';
import { Button } from '@/components/ui/Button';
import { Car, LogOut, User, Wallet, FileText, Home } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

interface DriverLayoutProps {
  children: React.ReactNode;
}

export const DriverLayout: React.FC<DriverLayoutProps> = ({ children }) => {
  const { user, logout } = useAuthStore();
  const { me } = useDriverStore();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  // Sürücü müsait mi?
  const isAvailable = me?.available ?? false;

  // Aktif sayfa kontrolü
  const isActive = (path: string) => location.pathname === path;

  const navItems = [
    { path: '/driver/dashboard', icon: Home, label: 'Panel' },
    { path: '/driver/earnings', icon: Wallet, label: 'Muhasebe' },
    { path: '/driver/documents', icon: FileText, label: 'Belgeler' },
  ];

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Header */}
      <nav className="bg-gray-800 border-b border-gray-700 sticky top-0 z-50">
        <div className="px-4">
          <div className="flex justify-between items-center h-14">
            {/* Sol: Logo + Durum */}
            <div className="flex items-center gap-3">
              <Car className="h-6 w-6 text-green-500" />
              <span className="text-lg font-bold text-white">GetTransfer</span>

              {/* Online/Offline Durum Göstergesi */}
              <div className={`hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${
                isAvailable
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-yellow-500/20 text-yellow-400'
              }`}>
                <div className={`w-2 h-2 rounded-full ${
                  isAvailable ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'
                }`}></div>
                {isAvailable ? 'Online' : 'Mola'}
              </div>
            </div>

            {/* Orta: Navigasyon */}
            <div className="hidden md:flex items-center gap-1">
              {navItems.map(item => (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive(item.path)
                      ? 'bg-green-600 text-white'
                      : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </button>
              ))}
            </div>

            {/* Sağ: Sürücü Adı + Çıkış */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-gray-300 text-sm">
                <User className="h-4 w-4" />
                <span className="hidden sm:inline">{user?.name || me?.name || 'Sürücü'}</span>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="text-gray-400 hover:text-white hover:bg-gray-700"
              >
                <LogOut className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">Çıkış</span>
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1">
        {children}
      </main>

      {/* Mobil Alt Navigasyon */}
      <nav className="md:hidden bg-gray-800 border-t border-gray-700 sticky bottom-0 z-50">
        <div className="flex justify-around py-2">
          {navItems.map(item => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-all ${
                isActive(item.path)
                  ? 'text-green-400'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <item.icon className="h-5 w-5" />
              <span className="text-xs">{item.label}</span>
              {isActive(item.path) && (
                <div className="w-1 h-1 bg-green-400 rounded-full"></div>
              )}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
};
