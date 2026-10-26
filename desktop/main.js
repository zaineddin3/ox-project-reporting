// Oxford Project Reporting desktop app (Electron shell around the same app the website runs).
const { app, BrowserWindow, ipcMain, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

const settingsFile = () => path.join(app.getPath('userData'), 'settings.json');
function readSettings() { try { return JSON.parse(fs.readFileSync(settingsFile(), 'utf8')); } catch { return {}; } }
function writeSettings(s) { fs.mkdirSync(path.dirname(settingsFile()), { recursive: true }); fs.writeFileSync(settingsFile(), JSON.stringify(s, null, 2)); }
// Connection details can also be shipped with the app in app/config.json (filled in at build time).
function bundledConfig() { try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'app', 'config.json'), 'utf8')); } catch { return {}; } }
function config() { const b = bundledConfig(), s = readSettings(); return { supabaseUrl: s.supabaseUrl || b.supabaseUrl || '', supabaseAnonKey: s.supabaseAnonKey || b.supabaseAnonKey || '', appUrl: s.appUrl ?? b.appUrl ?? '' }; }
const configured = c => c.supabaseUrl && c.supabaseAnonKey && !/YOUR_/.test(c.supabaseUrl + c.supabaseAnonKey);

let win;
function loadMain() {
  const c = config();
  if (!configured(c)) return win.loadFile(path.join(__dirname, 'app', 'settings.html'));
  const local = () => win.loadFile(path.join(__dirname, 'app', 'index.html'));
  if (c.appUrl) {
    // Load the live website so updates made through Claude appear without reinstalling; fall back to the copy inside the app when offline.
    win.webContents.once('did-fail-load', (_e, code, _d, url, isMain) => { if (isMain !== false) local(); });
    win.loadURL(c.appUrl).catch(local);
  } else local();
}
function openSettings() { win.loadFile(path.join(__dirname, 'app', 'settings.html')); }

function createWindow() {
  win = new BrowserWindow({
    width: 1440, height: 920, minWidth: 900, minHeight: 600, backgroundColor: '#1c2732', title: 'Oxford Project Reporting',
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { const c = config(); if (/^https?:/.test(url) && !(c.appUrl && url.startsWith(c.appUrl))) { e.preventDefault(); shell.openExternal(url); } });
  loadMain();
}

ipcMain.on('get-config', e => { const c = config(); e.returnValue = configured(c) ? { supabaseUrl: c.supabaseUrl, supabaseAnonKey: c.supabaseAnonKey } : null; });
ipcMain.on('get-settings', e => { e.returnValue = config(); });
ipcMain.handle('save-settings', (_e, s) => { writeSettings({ supabaseUrl: (s.supabaseUrl || '').trim(), supabaseAnonKey: (s.supabaseAnonKey || '').trim(), appUrl: (s.appUrl || '').trim() }); loadMain(); return true; });
ipcMain.handle('open-settings', () => openSettings());
ipcMain.handle('open-external', (_e, url) => { if (/^https:/.test(url)) shell.openExternal(url); });

const isMac = process.platform === 'darwin';
Menu.setApplicationMenu(Menu.buildFromTemplate([
  ...(isMac ? [{ role: 'appMenu' }] : []),
  { label: 'File', submenu: [{ label: 'Connection settings…', click: openSettings }, { type: 'separator' }, isMac ? { role: 'close' } : { role: 'quit' }] },
  { role: 'editMenu' },
  { label: 'View', submenu: [{ role: 'reload' }, { type: 'separator' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' }, { role: 'togglefullscreen' }] },
  { role: 'windowMenu' }
]));

app.whenReady().then(() => { createWindow(); app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); }); });
app.on('window-all-closed', () => { if (!isMac) app.quit(); });
