import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import { settingsStore } from '@/state/settings';
import en from './locales/en.json';
import ru from './locales/ru.json';

void i18next.use(initReactI18next).init({
  resources: { en: { translation: en }, ru: { translation: ru } },
  lng: settingsStore.get().language,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

document.documentElement.lang = settingsStore.get().language;

// the language setting is the one source of truth; i18next and <html lang> mirror it
settingsStore.subscribe(() => {
  const { language } = settingsStore.get();
  if (i18next.language !== language) void i18next.changeLanguage(language);
  document.documentElement.lang = language;
});
