/* ════════════════════════════════════════════════════════════════════
   VOID RAIDER — Electron desktop shell
   Starts the co-op server in-process on a free local port, then loads the
   game from it. Because the client is served over http://localhost:<port>,
   its same-origin WebSocket logic "just works" — single player runs fully
   offline and the app can host co-op locally with zero configuration.
═══════════════════════════════════════════════════════════════════════ */
import { app, BrowserWindow, shell } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startServer } from "../server/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let win = null;
let serverInfo = null;

async function createWindow() {
  // packaged: dist ships as an unpacked resource; dev: it's the repo build
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
    title: "VOID RAIDER",
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // open external links (flags CDN, etc.) in the system browser, not the app
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  win.loadURL(`http://localhost:${serverInfo.port}`);
  win.on("closed", () => {
    win = null;
  });
}

app.whenReady().then(createWindow);

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on("window-all-closed", () => {
  serverInfo?.server?.close();
  if (process.platform !== "darwin") app.quit();
});
