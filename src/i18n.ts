import { createI18n } from 'vue-i18n';
import en from './locales/en.json';
import zhCN from './locales/zh-CN.json';

const i18n = createI18n({
  legacy: false, // Use Composition API
  locale: localStorage.getItem('lang') || navigator.language || 'en',
  fallbackLocale: 'en',
  messages: {
    en: en,
    'zh-CN': zhCN,
  },
});

export default i18n;
