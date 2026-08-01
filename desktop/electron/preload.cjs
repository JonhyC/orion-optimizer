const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("orion", {
  getSettings: () => ipcRenderer.invoke("settings:get"),
  saveSettings: (settings) => ipcRenderer.invoke("settings:save", settings),
  login: (credentials) => ipcRenderer.invoke("auth:login", credentials),
  logout: () => ipcRenderer.invoke("auth:logout"),
  catalog: () => ipcRenderer.invoke("catalog:get"),
  profile: () => ipcRenderer.invoke("system:profile"),
  preview: (tweak) => ipcRenderer.invoke("tweak:preview", tweak),
  apply: (tweak) => ipcRenderer.invoke("tweak:apply", tweak),
  sessions: () => ipcRenderer.invoke("history:list"),
  rollback: (session) => ipcRenderer.invoke("history:rollback", session),
  openPortal: (pathname) => ipcRenderer.invoke("portal:open", pathname),
  minimize: () => ipcRenderer.send("window:minimize"),
  maximize: () => ipcRenderer.send("window:maximize"),
  close: () => ipcRenderer.send("window:close"),
});
