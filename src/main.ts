import favicon from '../icon/logo.svg?inline';

const setFavicon = (favImg: string) => {
  const head = document.querySelector('head');
  if (head) {
    const link = document.createElement('link');
    link.rel = 'icon';
    link.type = 'image/svg+xml';
    link.href = favImg;
    head.appendChild(link);
  }
};

setFavicon(favicon);

import { createApp } from 'vue'
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'
import App from './App.vue'
import i18n from './i18n'

createApp(App).use(i18n).mount('#app')