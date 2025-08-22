import { app, BrowserWindow, shell, Menu, dialog, ipcMain } from 'electron';
import path from 'path';
import { autoUpdater } from 'electron-updater';

let mainWindow: BrowserWindow | null = null;
let manualCheckForUpdates = false;

// --- Internationalization (i18n) for Menu ---
const translations: Record<string, Record<string, string>> = {
  en: {
    view: 'View',
    reload: 'Reload',
    forceReload: 'Force Reload',
    toggleDevTools: 'Toggle Developer Tools',
    help: 'Help',
    about: 'About',
    operatingGuide: 'Operating Guide',
    language: 'Language',
    services: 'Services',
    hide: 'Hide',
    hideOthers: 'Hide Others',
    unhide: 'Show All',
    quit: 'Quit',
    update: 'Check for Updates...',
  },
  'zh-CN': {
    view: '视图',
    reload: '刷新',
    forceReload: '强制刷新',
    toggleDevTools: '切换开发者工具',
    help: '帮助',
    about: '关于',
    operatingGuide: '使用指南',
    language: '语言',
    services: '服务',
    hide: '隐藏',
    hideOthers: '隐藏其他',
    unhide: '全部显示',
    quit: '退出',
    update: '检查更新...',
  }
};

const createMenu = (lang: 'en' | 'zh-CN' = 'zh-CN') => {
  const t = translations[lang] || translations['zh-CN'];
  const menuTemplate: (Electron.MenuItemConstructorOptions | Electron.MenuItem)[] = [
    {
      label: t.view,
      submenu: [
        { role: 'reload', label: t.reload },
        { role: 'forceReload', label: t.forceReload },
        { role: 'toggleDevTools', label: t.toggleDevTools },
      ]
    },
    {
      label: t.help,
      role: 'help',
      submenu: [
        {
          label: t.operatingGuide,
          click: () => {
            mainWindow?.webContents.send('show-help-dialog');
          }
        },
        {
          label: t.about,
          click: () => {
            mainWindow?.webContents.send('show-about-dialog');
          }
        }
      ]
    }
  ];

  if (process.platform === 'darwin') {
    const appMenu: Electron.MenuItemConstructorOptions = {
      label: app.getName(),
      submenu: [
        { role: 'about', label: `${t.about} ${app.getName()}` },
        { type: 'separator' },
        { label: t.update, click: checkForUpdatesManual },
        { type: 'separator' },
        { label: t.language, submenu: [
          { label: 'English', type: 'radio', checked: lang === 'en', click: () => mainWindow?.webContents.send('set-language', 'en') },
          { label: '简体中文', type: 'radio', checked: lang === 'zh-CN', click: () => mainWindow?.webContents.send('set-language', 'zh-CN') }
        ]},
        { type: 'separator' },
        { role: 'services', label: t.services },
        { type: 'separator' },
        { role: 'hide', label: `${t.hide} ${app.getName()}` },
        { role: 'hideOthers', label: t.hideOthers },
        { role: 'unhide', label: t.unhide },
        { type: 'separator' },
        { role: 'quit', label: `${t.quit} ${app.getName()}` }
      ]
    };
    menuTemplate.unshift(appMenu);

    const helpMenu = menuTemplate.find(m => m.role === 'help');
    if (helpMenu && helpMenu.submenu) {
      // Remove the default about item if it exists (it will be added back with IPC)
      const aboutItemIndex = (helpMenu.submenu as Electron.MenuItemConstructorOptions[]).findIndex(i => i.label === t.about);
      if (aboutItemIndex !== -1) {
        (helpMenu.submenu as Electron.MenuItemConstructorOptions[]).splice(aboutItemIndex, 1);
      }
      // Add the custom about item with IPC call
      (helpMenu.submenu as Electron.MenuItemConstructorOptions[]).push(
        { type: 'separator' },
        {
          label: t.about,
          click: () => {
            mainWindow?.webContents.send('show-about-dialog');
          }
        }
      );
    }
  } else {
    const helpMenu = menuTemplate.find(m => m.role === 'help');
    if (helpMenu && helpMenu.submenu) {
      (helpMenu.submenu as Electron.MenuItemConstructorOptions[]).push(
        { type: 'separator' },
        { label: t.update, click: checkForUpdatesManual }
      );
    }
    // Add language menu to help menu on Windows/Linux
    const languageMenu: Electron.MenuItemConstructorOptions = {
      label: t.language,
      submenu: [
        { label: 'English', type: 'radio', checked: lang === 'en', click: () => mainWindow?.webContents.send('set-language', 'en') },
        { label: '简体中文', type: 'radio', checked: lang === 'zh-CN', click: () => mainWindow?.webContents.send('set-language', 'zh-CN') }
      ]
    };
    menuTemplate.splice(1, 0, languageMenu);
  }

  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);
}

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: 'deny' };
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
};

const checkForUpdatesManual = () => {
  manualCheckForUpdates = true;
  autoUpdater.checkForUpdates();
};

app.on('ready', () => {
  createWindow();

  // Create menu with system language on initial startup
  const systemLang = app.getLocale().startsWith('zh') ? 'zh-CN' : 'en';
  createMenu(systemLang);
  
  // Check for updates on startup silently
  autoUpdater.checkForUpdates();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// --- IPC and Auto-updater Events ---

ipcMain.on('language-changed', (event, lang) => {
  createMenu(lang);
});

autoUpdater.on('update-not-available', () => {
  if (manualCheckForUpdates) {
    manualCheckForUpdates = false;
    mainWindow?.webContents.send('update-not-available');
  }
});

autoUpdater.on('update-downloaded', (info) => {
  mainWindow?.webContents.send('update-downloaded', info);
});

autoUpdater.on('error', (err) => {
  if (manualCheckForUpdates) {
    manualCheckForUpdates = false;
    if (err.message.includes('404')) {
      mainWindow?.webContents.send('update-not-available');
    } else {
      mainWindow?.webContents.send('update-error', err);
    }
  }
});
