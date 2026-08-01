import { app, BrowserWindow, ipcMain, shell } from "electron";
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const isDev = !app.isPackaged;
const executionMode = isDev ? process.env.ORION_DESKTOP_MODE ?? "Mock" : "Real";
const APP_PROTOCOL = "orion-optimizer";

if (process.defaultApp && process.argv[1]) {
  app.setAsDefaultProtocolClient(APP_PROTOCOL, process.execPath, [path.resolve(process.argv[1])]);
} else {
  app.setAsDefaultProtocolClient(APP_PROTOCOL);
}

const hasInstanceLock = app.requestSingleInstanceLock();
if (!hasInstanceLock) app.quit();

if (isDev) app.commandLine.appendSwitch("remote-debugging-port", "9223");

let mainWindow;
let apiToken = null;
let account = null;
let cachedProfile = null;
let catalogCache = [];

function focusMainWindow() {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

if (hasInstanceLock) {
  app.on("second-instance", () => focusMainWindow());
  app.on("open-url", (event) => {
    event.preventDefault();
    focusMainWindow();
  });
}

function enginePaths() {
  if (app.isPackaged) {
    return {
      modules: path.join(process.resourcesPath, "engine", "modules"),
      scripts: path.join(process.resourcesPath, "engine", "powershell"),
    };
  }
  return {
    modules: path.resolve(here, "..", "..", "client", "modules"),
    scripts: path.resolve(here, "..", "powershell"),
  };
}

function settingsPath() {
  return path.join(app.getPath("userData"), "settings.json");
}

async function readSettings() {
  try {
    const stored = JSON.parse(await fs.readFile(settingsPath(), "utf8"));
    return {
      server: typeof stored.server === "string" ? stored.server : "http://localhost:3400",
      username: typeof stored.username === "string" ? stored.username : "",
    };
  } catch {
    return { server: "http://localhost:3400", username: "" };
  }
}

async function saveSettings(next) {
  const safe = {
    server: String(next?.server ?? "http://localhost:3400").replace(/\/$/, ""),
    username: String(next?.username ?? "").slice(0, 80),
  };
  await fs.mkdir(path.dirname(settingsPath()), { recursive: true });
  await fs.writeFile(settingsPath(), JSON.stringify(safe, null, 2), "utf8");
  return safe;
}

function runProcess(file, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(file, args, { windowsHide: true });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (data) => (stdout += data));
    child.stderr.on("data", (data) => (stderr += data));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(stderr.trim() || `PowerShell terminou com codigo ${code}`));
    });
  });
}

async function invokeBridge(command, payload = {}, elevated = false) {
  const id = crypto.randomUUID();
  const tempDir = path.join(app.getPath("temp"), "OrionOptimizer");
  const payloadPath = path.join(tempDir, `${id}.input.json`);
  const resultPath = path.join(tempDir, `${id}.output.json`);
  const { modules, scripts } = enginePaths();
  await fs.mkdir(tempDir, { recursive: true });
  await fs.writeFile(payloadPath, JSON.stringify({ ...payload, mode: executionMode }), "utf8");

  const bridgeArgs = [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    path.join(scripts, "OrionBridge.ps1"),
    "-Command",
    command,
    "-PayloadPath",
    payloadPath,
    "-ResultPath",
    resultPath,
    "-ModulesPath",
    modules,
  ];

  try {
    if (elevated && executionMode === "Real") {
      await runProcess("powershell.exe", [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        path.join(scripts, "Invoke-OrionElevated.ps1"),
        "-BridgePath",
        path.join(scripts, "OrionBridge.ps1"),
        "-Command",
        command,
        "-PayloadPath",
        payloadPath,
        "-ResultPath",
        resultPath,
        "-ModulesPath",
        modules,
      ]);
    } else {
      await runProcess("powershell.exe", bridgeArgs);
    }
    const raw = (await fs.readFile(resultPath, "utf8")).replace(/^\uFEFF/, "");
    const result = JSON.parse(raw);
    if (!result.ok) throw new Error(result.error || "A operacao falhou.");
    return result.data;
  } finally {
    await Promise.allSettled([fs.unlink(payloadPath), fs.unlink(resultPath)]);
  }
}

async function api(pathname, init = {}) {
  const settings = await readSettings();
  const headers = { "Content-Type": "application/json", ...(init.headers ?? {}) };
  if (apiToken) headers.Authorization = `Bearer ${apiToken}`;
  let response;
  try {
    response = await fetch(`${settings.server}${pathname}`, { ...init, headers });
  } catch {
    throw new Error("Nao foi possivel contactar o servidor Orion.");
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) throw new Error(data.error || `Erro HTTP ${response.status}`);
  return data;
}

async function authorizedTweak(id, revalidate = false) {
  if (!apiToken) throw new Error("A sessao terminou. Inicia sessao novamente.");
  if (revalidate || catalogCache.length === 0) {
    const data = await api("/api/catalog");
    catalogCache = Array.isArray(data.catalog?.tweaks) ? data.catalog.tweaks : [];
  }
  const tweak = catalogCache.find((item) => item.id === String(id ?? ""));
  if (!tweak) throw new Error("Esta otimizacao ja nao pertence ao catalogo autorizado.");

  cachedProfile ??= await invokeBridge("profile");
  const eligibility = await invokeBridge("eligibility", {
    tweaks: [tweak],
    profile: cachedProfile,
  });
  const check = eligibility[tweak.id];
  if (!check?.eligible) throw new Error(check?.reason || "Otimizacao incompativel com este PC.");
  return tweak;
}

function registerIpc() {
  ipcMain.handle("settings:get", readSettings);
  ipcMain.handle("settings:save", (_event, settings) => saveSettings(settings));
  ipcMain.handle("system:profile", async () => {
    cachedProfile ??= await invokeBridge("profile");
    return { ...cachedProfile, executionMode };
  });
  ipcMain.handle("auth:login", async (_event, credentials) => {
    cachedProfile ??= await invokeBridge("profile");
    const settings = await saveSettings({
      server: credentials.server,
      username: credentials.remember ? credentials.username : "",
    });
    const data = await api("/api/login", {
      method: "POST",
      body: JSON.stringify({
        username: String(credentials.username ?? "").trim(),
        password: String(credentials.password ?? "").trim(),
        hwid: cachedProfile.hwid,
      }),
    });
    apiToken = data.token;
    account = data.user;
    return { user: account, server: settings.server };
  });
  ipcMain.handle("auth:logout", async () => {
    if (apiToken) await api("/api/logout", { method: "POST" }).catch(() => undefined);
    apiToken = null;
    account = null;
    catalogCache = [];
    return true;
  });
  ipcMain.handle("catalog:get", async () => {
    if (!apiToken) throw new Error("Inicia sessao primeiro.");
    const data = await api("/api/catalog");
    catalogCache = data.catalog.tweaks;
    cachedProfile ??= await invokeBridge("profile");
    const eligibility = await invokeBridge("eligibility", {
      tweaks: data.catalog.tweaks,
      profile: cachedProfile,
    });
    return { tweaks: data.catalog.tweaks, eligibility, account };
  });
  ipcMain.handle("tweak:preview", async (_event, tweak) => {
    const trusted = await authorizedTweak(tweak?.id);
    return invokeBridge("preview", { tweak: trusted });
  });
  ipcMain.handle("tweak:apply", async (_event, tweak) => {
    // Revalidar em cada execucao impede que um catalogo ja aberto continue a
    // funcionar depois da licenca expirar ou de a conta ser suspensa.
    const trusted = await authorizedTweak(tweak?.id, true);
    return invokeBridge("apply", { tweak: trusted }, Number(trusted.layer) >= 1);
  });
  ipcMain.handle("history:list", async () => {
    const result = await invokeBridge("sessions");
    const items = result?.items?.value ?? result?.items;
    return Array.isArray(items) ? items : items ? [items] : [];
  });
  ipcMain.handle("history:rollback", (_event, session) => {
    const elevated = Array.isArray(session?.entries) && session.entries.some((entry) => entry.hive === "HKLM");
    return invokeBridge("rollback", { session }, elevated);
  });
  ipcMain.handle("portal:open", async (_event, pathname) => {
    if (!account) throw new Error("Inicia sessao primeiro.");
    const routes = {
      staff: new Set(["/panel", "/panel/admin", "/panel/admin/users", "/panel/admin/reviews"]),
      developer: new Set(["/panel", "/panel/admin", "/panel/admin/users", "/panel/admin/reviews", "/panel/admin/catalog"]),
      owner: new Set(["/panel", "/panel/admin", "/panel/admin/users", "/panel/admin/reviews", "/panel/admin/catalog", "/panel/admin/plans", "/panel/admin/orders"]),
    };
    const allowed = routes[account.role];
    const safePath = String(pathname ?? "");
    if (!allowed?.has(safePath)) throw new Error("Este atalho nao esta disponivel para o teu cargo.");
    const settings = await readSettings();
    await shell.openExternal(new URL(safePath, `${settings.server}/`).toString());
    return true;
  });

  ipcMain.on("window:minimize", () => mainWindow?.minimize());
  ipcMain.on("window:maximize", () => {
    if (!mainWindow) return;
    mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
  });
  ipcMain.on("window:close", () => mainWindow?.close());
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 980,
    minHeight: 650,
    backgroundColor: "#07090d",
    icon: isDev ? path.resolve(here, "..", "build", "icon.png") : undefined,
    show: false,
    titleBarStyle: "hidden",
    titleBarOverlay: { color: "#07090d", symbolColor: "#98a2b3", height: 42 },
    webPreferences: {
      preload: path.join(here, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: !isDev,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) void shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.webContents.on("did-finish-load", () => mainWindow?.show());
  mainWindow.webContents.on("did-fail-load", (_event, code, description) => {
    console.error(`[orion] renderer falhou (${code}): ${description}`);
    mainWindow?.show();
  });
  mainWindow.webContents.on("console-message", (_event, details) => {
    if (details.level === "error") console.error(`[orion renderer] ${details.message}`);
  });
  if (isDev) void mainWindow.loadURL("http://127.0.0.1:5174");
  else void mainWindow.loadFile(path.join(here, "..", "dist", "index.html"));
  setTimeout(() => mainWindow?.show(), 1500).unref();
}

app.whenReady().then(() => {
  registerIpc();
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
