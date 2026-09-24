import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'civicsync.locale';
const supportedLocales = ['en', 'bn'];
const messages = {
  en: { common: { loading: 'Loading…', retry: 'Try again', cancel: 'Cancel', save: 'Save' }, navigation: { commandCenter: 'Command Center' } },
  bn: { common: { loading: 'লোড হচ্ছে…', retry: 'আবার চেষ্টা করুন', cancel: 'বাতিল', save: 'সংরক্ষণ করুন' }, navigation: { commandCenter: 'কমান্ড সেন্টার' } }
};

function readLocale() {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return supportedLocales.includes(value) ? value : 'en';
  } catch { return 'en'; }
}

export function LocaleProvider({ children }) {
  const [locale, setLocaleState] = useState(readLocale);
  useEffect(() => {
    document.documentElement.lang = locale;
    try { window.localStorage.setItem(STORAGE_KEY, locale); } catch { /* storage unavailable */ }
  }, [locale]);
  const setLocale = useCallback((value) => { if (supportedLocales.includes(value)) setLocaleState(value); }, []);
  const t = useCallback((key, fallback = '') => key.split('.').reduce((value, part) => value?.[part], messages[locale]) ?? fallback ?? key, [locale]);
  const value = useMemo(() => ({ locale, setLocale, supportedLocales, t }), [locale, setLocale, t]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

const LocaleContext = createContext({ locale: 'en', setLocale: () => {}, supportedLocales, t: (key, fallback) => fallback || key });
export const useLocale = () => useContext(LocaleContext);
export { supportedLocales };
