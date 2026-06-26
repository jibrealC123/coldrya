// Preload bridge — exposes the auto-updater status to the React app.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("voidUpdater", {
  // subscribe to update lifecycle events; returns an unsubscribe fn
  onStatus: (cb) => {
    const handler = (_e, data) => cb(data);
    ipcRenderer.on("update-status", handler);
    return () => ipcRenderer.removeListener("update-status", handler);
  },
  // quit and install the downloaded update
  restart: () => ipcRenderer.send("update-restart"),
  // open the releases page (fallback when auto-install isn't possible)
  openReleases: () => ipcRenderer.send("update-open-releases"),
});
