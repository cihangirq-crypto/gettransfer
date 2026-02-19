import React from 'react';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/Button';
import { LogOut, User, Settings, Users, DollarSign, Menu, Wallet, X } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const menuItems = [
    { path: '/admin/drivers', label: 'Sürücüler', icon: Users },
    { path: '/admin/accounting', label: 'Muhasebe', icon: Wallet },
    { path: '/admin/pricing', label: 'Fiyatlandırma', icon: DollarSign },
  ];

  const isActive = (path: string) => location.pathname === path;

  // Aktif sayfa başlığı
  const activeItem = menuItems.find(item => isActive(item.path));
  const pageTitle = activeItem?.label || 'Admin Paneli';

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile Sidebar (Slide from left) */}
      <aside className={`
        fixed lg:hidden inset-y-0 left-0 z-50
        w-72 bg-gray-800/95 backdrop-blur-lg border-r border-gray-700
        transform transition-transform duration-300 ease-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-4 border-b border-gray-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-600 rounded-xl flex items-center justify-center shadow-lg shadow-red-600/20">
                  <Settings className="h-5 w-5 text-white" />
                </div>
                <div>
                  <span className="text-lg font-bold text-white">GetTransfer</span>
                  <div className="text-xs text-red-400 font-medium">Admin Paneli</div>
                </div>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-3 space-y-1">
            {menuItems.map((item) => (
              <button
                key={item.path}
                onClick={() => {
                  navigate(item.path);
                  setSidebarOpen(false);
                }}
                className={`
                  w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-left transition-all duration-200
                  ${isActive(item.path) 
                    ? 'bg-red-600 text-white shadow-lg shadow-red-600/20' 
                    : 'text-gray-300 hover:bg-gray-700/50 hover:text-white'
                  }
                `}
              >
                <item.icon className="h-5 w-5" />
                <span className="font-medium">{item.label}</span>
              </button>
            ))}
          </nav>

          {/* User Info & Logout */}
          <div className="p-4 border-t border-gray-700">
            <div className="flex items-center gap-3 mb-4 px-2">
              <div className="w-10 h-10 bg-gradient-to-br from-gray-600 to-gray-700 rounded-full flex items-center justify-center">
                <User className="h-5 w-5 text-gray-300" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{user?.name || 'Admin'}</p>
                <p className="text-xs text-gray-400">Yönetici</p>
              </div>
            </div>
            <Button
              variant="outline"
              className="w-full border-gray-600 text-gray-300 hover:bg-red-600 hover:text-white hover:border-red-600 transition-all"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Çıkış Yap
            </Button>
          </div>
        </div>
      </aside>

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 bg-gray-800 border-r border-gray-700 flex-col">
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-600 rounded-xl flex items-center justify-center shadow-lg shadow-red-600/20">
              <Settings className="h-5 w-5 text-white" />
            </div>
            <div>
              <span className="text-lg font-bold text-white">GetTransfer</span>
              <div className="text-xs text-red-400 font-medium">Admin Paneli</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {menuItems.map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`
                w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all duration-200
                ${isActive(item.path) 
                  ? 'bg-red-600 text-white shadow-lg shadow-red-600/20' 
                  : 'text-gray-300 hover:bg-gray-700/50 hover:text-white'
                }
              `}
            >
              <item.icon className="h-5 w-5" />
              <span className="font-medium">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-700">
          <div className="flex items-center gap-3 mb-3 px-2">
            <div className="w-9 h-9 bg-gradient-to-br from-gray-600 to-gray-700 rounded-full flex items-center justify-center">
              <User className="h-4 w-4 text-gray-300" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.name || 'Admin'}</p>
              <p className="text-xs text-gray-400">Yönetici</p>
            </div>
          </div>
          <Button
            variant="outline"
            className="w-full border-gray-600 text-gray-300 hover:bg-red-600 hover:text-white hover:border-red-600 transition-all"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Çıkış Yap
          </Button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Mobile Header */}
        <header className="lg:hidden bg-gray-800/95 backdrop-blur-lg border-b border-gray-700 sticky top-0 z-30">
          <div className="px-4 h-14 flex items-center justify-between">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 -ml-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
            >
              <Menu className="h-6 w-6" />
            </button>
            
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-red-500" />
              <span className="text-white font-semibold">{pageTitle}</span>
            </div>
            
            <button
              onClick={handleLogout}
              className="p-2 -mr-2 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded-lg transition-colors"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto pb-20 lg:pb-0">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-gray-800/95 backdrop-blur-lg border-t border-gray-700 z-30 safe-area-inset-bottom">
        <div className="flex justify-around items-center h-16">
          {menuItems.map(item => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors ${
                isActive(item.path)
                  ? 'text-red-400'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <item.icon className="h-5 w-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
              {isActive(item.path) && (
                <div className="absolute bottom-1 w-8 h-0.5 bg-red-500 rounded-full"></div>
              )}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
};
