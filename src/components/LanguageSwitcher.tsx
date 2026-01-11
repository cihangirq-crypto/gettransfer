import React from 'react'
import { useI18n } from '@/i18n'

export const LanguageSwitcher: React.FC = () => {
  const { lang, setLang } = useI18n()
  return (
    <select
      value={lang}
      onChange={(e)=>setLang(e.target.value)}
      className="border border-gray-300 rounded-md px-2 py-1 text-sm"
    >
      <option value="tr">Türkçe</option>
      <option value="en">English</option>
    </select>
  )
}

