/* ════════════════════════════════════════════════════════════════════
   VOID RAIDER — Electron desktop shell
   Starts the co-op server in-process on a free local port, then loads the
   game from it. Because the client is served over http://localhost:<port>,
   its same-origin WebSocket logic "just works" — single player runs fully
   offline and the app can host co-op locally with zero configuration.

   Auto-update: on launch (packaged only) it checks GitHub Releases, downloads
   any newer version in the background with progress, and installs on restart.
═══════════════════════════════════════════════════════════════════════ */
import { app, BrowserWindow, shell, ipcMain } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import electronUpdater from "electron-updater";
import { startServer } from "../server/index.js";

const { autoUpdater } = electronUpdater;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RELEASES_URL = "https://github.com/jibrealC123/coldrya/releases";

let win = null;
let serverInfo = null;

async function createWindow() {
  const distPath = app.isPackaged
    ? path.join(process.resourcesPath, "dist")
    : path.join(__dirname, "..", "dist");

  serverInfo = await startServer({ port: 0, distPath });

  win = new BrowserWindow({
    width: 1100,
    height: 820,
    minWidth: 640,
    minHeight: 480,
    backgroundColor: "#0f172a",
    title: "ColdRya",
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });

  const appOrigin = `http://localhost:${serverInfo.port}`;

  // external links (flags CDN, etc.) open in the system browser — but only
  // safe http/https schemes (never file:, etc.)
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });

  // block the renderer from navigating the window away from the app itself
  win.webContents.on("will-navigate", (e, url) => {
    if (!url.startsWith(appOrigin)) e.preventDefault();
  });

  win.loadURL(appOrigin);
  win.on("closed", () => {
    win = null;
  });

  win.webContents.once("did-finish-load", () => setupUpdates());
}

/* ── auto-update ──────────────────────────────────────────────────── */
function sendStatus(phase, data = {}) {
  if (win && !win.isDestroyed()) win.webContents.send("update-status", { phase, ...data });
}

function setupUpdates() {
  if (!app.isPackaged) return; // only the installed app self-updates
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("checking-for-update", () => sendStatus("checking"));
  autoUpdater.on("update-available", (info) => sendStatus("available", { version: info.version }));
  autoUpdater.on("update-not-available", () => sendStatus("none"));
  autoUpdater.on("download-progress", (p) =>
    sendStatus("downloading", { percent: Math.round(p.percent), perSec: p.bytesPerSecond })
  );
  autoUpdater.on("update-downloaded", (info) => sendStatus("ready", { version: info.version }));
  autoUpdater.on("error", (err) => sendStatus("error", { message: String(err?.message || err) }));

  autoUpdater.checkForUpdates().catch((e) => sendStatus("error", { message: String(e) }));
}

ipcMain.on("update-restart", () => {
  try {
    autoUpdater.quitAndInstall();
  } catch {
    shell.openExternal(RELEASES_URL);
  }
});
ipcMain.on("update-open-releases", () => shell.openExternal(RELEASES_URL));

app.whenReady().then(createWindow);

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on("window-all-closed", () => {
  serverInfo?.server?.close();
  if (process.platform !== "darwin") app.quit();
});
