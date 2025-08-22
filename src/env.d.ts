export {};

declare global {
  interface Window {
    ipcApi: {
      // Renderer to Main
      sendLanguageChange: (lang: string) => void;

      // Main to Renderer
      onUpdateNotAvailable: (callback: () => void) => void;
      onUpdateDownloaded: (callback: (info: any) => void) => void;
      onUpdateError: (callback: (error: Error) => void) => void;
      onShowHelpDialog: (callback: () => void) => void;
      onSetLanguage: (callback: (lang: string) => void) => void;
    };
  }
}
