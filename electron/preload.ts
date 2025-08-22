import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('ipcApi', {
  // --- Renderer to Main ---
  sendLanguageChange: (lang: string) => {
    ipcRenderer.send('language-changed', lang);
  },

  // --- Main to Renderer ---
  onUpdateNotAvailable: (callback: () => void) => {
    ipcRenderer.on('update-not-available', callback);
  },
  onUpdateDownloaded: (callback: (info: any) => void) => {
    ipcRenderer.on('update-downloaded', (event, ...args) => callback(args[0]));
  },
  onUpdateError: (callback: (error: Error) => void) => {
    ipcRenderer.on('update-error', (event, ...args) => callback(args[0]));
  },
  onShowHelpDialog: (callback: () => void) => {
    ipcRenderer.on('show-help-dialog', callback);
  },
  onShowAboutDialog: (callback: () => void) => {
    ipcRenderer.on('show-about-dialog', callback);
  },
  onSetLanguage: (callback: (lang: string) => void) => {
    ipcRenderer.on('set-language', (event, ...args) => callback(args[0]));
  }
});