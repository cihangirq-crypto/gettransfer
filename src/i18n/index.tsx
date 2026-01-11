import React from 'react'

type Dict = Record<string, string>

const tr: Dict = {
  'brand': 'GetTransfer',
  'nav.home': 'Ana Sayfa',
  'nav.search': 'Ara',
  'customer.reservations': 'Rezervasyonlarım',
  'profile': 'Profil',
  'driver.panel': 'Sürücü Paneli',
  'driver.documents': 'Dokümanlar',
  'auth.logout': 'Çıkış',
  'auth.driverLogin': 'Sürücü Girişi',
  'auth.login': 'Giriş Yap',
  'auth.register': 'Kayıt Ol',
  'footer.customers': 'Müşteriler',
  'footer.search': 'Transfer Ara',
  'footer.reservations': 'Rezervasyonlarım',
  'footer.register': 'Kayıt Ol',
  'footer.drivers': 'Sürücüler',
  'footer.beDriver': 'Sürücü Ol',
  'footer.driverPanel': 'Sürücü Paneli',
  'footer.documents': 'Dokümanlar',
  'footer.help': 'Yardım',
  'footer.helpCenter': 'Yardım Merkezi',
  'footer.contact': 'İletişim',
  'footer.terms': 'Şartlar ve Koşullar',
  'footer.copy': 'Tüm hakları saklıdır.',
  'detector.title': 'Konumunuzu Belirleyin',
  'detector.autoFetching': 'Konumunuz otomatik olarak alınıyor...',
  'detector.error.title': 'Konum Alınamadı',
  'detector.retry': 'Tekrar Dene',
  'detector.manual': 'Manuel Konum',
  'detector.tip': 'Daha hassas sonuç için konum izni verin.',
}

const en: Dict = {
  'brand': 'GetTransfer',
  'nav.home': 'Home',
  'nav.search': 'Search',
  'customer.reservations': 'My Bookings',
  'profile': 'Profile',
  'driver.panel': 'Driver Panel',
  'driver.documents': 'Documents',
  'auth.logout': 'Logout',
  'auth.driverLogin': 'Driver Login',
  'auth.login': 'Login',
  'auth.register': 'Register',
  'footer.customers': 'Customers',
  'footer.search': 'Find Transfer',
  'footer.reservations': 'My Bookings',
  'footer.register': 'Register',
  'footer.drivers': 'Drivers',
  'footer.beDriver': 'Become a Driver',
  'footer.driverPanel': 'Driver Panel',
  'footer.documents': 'Documents',
  'footer.help': 'Help',
  'footer.helpCenter': 'Help Center',
  'footer.contact': 'Contact',
  'footer.terms': 'Terms & Conditions',
  'footer.copy': 'All rights reserved.',
  'detector.title': 'Set Your Location',
  'detector.autoFetching': 'Your location is being fetched automatically...',
  'detector.error.title': 'Location Unavailable',
  'detector.retry': 'Retry',
  'detector.manual': 'Manual Location',
  'detector.tip': 'For better accuracy, allow location permission.',
}

const dicts: Record<string, Dict> = { tr, en }

type Ctx = {
  lang: string
  setLang: (l: string) => void
  t: (k: string) => string
}

const I18nContext = React.createContext<Ctx | null>(null)

export const I18nProvider: React.FC<{ children: React.ReactNode }>=({ children })=>{
  const detect = () => {
    const saved = localStorage.getItem('lang')
    if (saved) return saved
    const nav = navigator.language?.toLowerCase() || 'en'
    const base = nav.split('-')[0]
    return ['tr','en'].includes(base) ? base : 'en'
  }
  const [lang, setLang] = React.useState<string>(detect())
  const t = (k: string) => (dicts[lang]?.[k] ?? dicts['en']?.[k] ?? k)
  const setLangWrap = (l: string) => { const v = ['tr','en'].includes(l) ? l : 'en'; setLang(v); localStorage.setItem('lang', v) }
  return <I18nContext.Provider value={{ lang, setLang: setLangWrap, t }}>{children}</I18nContext.Provider>
}

export const useI18n = () => {
  const ctx = React.useContext(I18nContext)
  if (!ctx) throw new Error('I18nProvider missing')
  return ctx
}

