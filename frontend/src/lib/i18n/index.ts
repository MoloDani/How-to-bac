import i18next from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'
import en from './locales/en.json'
import ro from './locales/ro.json'

export const LANGUAGES = { ro: 'Română', en: 'English' } as const
export type Language = keyof typeof LANGUAGES

void i18next
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { ro: { translation: ro }, en: { translation: en } },
    fallbackLng: 'ro',
    supportedLngs: Object.keys(LANGUAGES),
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'howtobac.lang',
    },
  })

i18next.on('languageChanged', (language) => {
  if (typeof document !== 'undefined') document.documentElement.lang = language
})

export default i18next
