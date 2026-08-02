import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
import electronUpdater from "electron-updater";
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
const { autoUpdater } = electronUpdater;
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

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
let updateInProgress = false;

function focusMainWindow() {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

if (hasInstanceLock) {
  app.on("second-instance", (_event, argv) => {
    focusMainWindow();
    void handleProtocolArgs(argv);
  });
  app.on("open-url", (event, url) => {
    event.preventDefault();
    focusMainWindow();
    void handleProtocolUrl(url);
  });
}

function protocolUrl(args) {
  return args.find((argument) => String(argument).startsWith(`${APP_PROTOCOL}://`)) ?? null;
}

async function handleProtocolArgs(args) {
  const value = protocolUrl(args);
  if (value) await handleProtocolUrl(value);
}

async function handleProtocolUrl(value) {
  let request;
  try {
    request = new URL(value);
  } catch {
    return;
  }
  if (request.hostname !== "update") {
    focusMainWindow();
    return;
  }
  await installLatestRelease({
    expectedVersion: request.searchParams.get("version"),
    feedUrl: request.searchParams.get("feed"),
    downloadUrl: request.searchParams.get("url"),
  });
}

async function installLatestRelease(updateRequest = {}) {
  if (updateInProgress) return;
  if (!app.isPackaged) {
    dialog.showMessageBox({
      type: "info",
      title: "Orion Optimizer",
      message: "A atualizacao automatica so esta ativa na aplicacao instalada.",
    });
    return;
  }
  updateInProgress = true;
  try {
    const settings = await readSettings();
    const feedUrl = resolveUpdateFeedUrl(updateRequest, settings.server);
    autoUpdater.setFeedURL({ provider: "generic", url: feedUrl });
    autoUpdater.on("download-progress", (progress) => {
      mainWindow?.setProgressBar(Math.max(0, Math.min(1, progress.percent / 100)));
      mainWindow?.setTitle(`Orion Optimizer · A atualizar ${Math.round(progress.percent)}%`);
    });

    focusMainWindow();
    mainWindow?.setProgressBar(2);
    mainWindow?.setTitle("Orion Optimizer · A procurar atualizacao");
    const result = await autoUpdater.checkForUpdates();
    const availableVersion = result?.updateInfo?.version;
    if (!availableVersion || compareVersions(availableVersion, app.getVersion()) <= 0) {
      const expectedVersion = updateRequest.expectedVersion;
      if (expectedVersion && compareVersions(expectedVersion, app.getVersion()) > 0) {
        throw new Error(`A versao ${expectedVersion} ainda nao esta disponivel no servidor.`);
      }
      mainWindow?.setProgressBar(-1);
      mainWindow?.setTitle("Orion Optimizer");
      focusMainWindow();
      return;
    }

    await autoUpdater.downloadUpdate();
    mainWindow?.setProgressBar(-1);
    mainWindow?.hide();
    setImmediate(() => autoUpdater.quitAndInstall(false, true));
  } catch (error) {
    mainWindow?.setProgressBar(-1);
    mainWindow?.setTitle("Orion Optimizer");
    dialog.showErrorBox(
      "Atualizacao do Orion Optimizer",
      error instanceof Error ? error.message : "Nao foi possivel instalar a atualizacao.",
    );
    updateInProgress = false;
  }
}

function isLocalServer(url) {
  return ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
}

function resolveUpdateFeedUrl(updateRequest, savedServer) {
  if (updateRequest.feedUrl) return normalizeFeedUrl(updateRequest.feedUrl);

  const fromDownload = feedFromDownloadUrl(updateRequest.downloadUrl);
  if (fromDownload) return fromDownload;

  const server = normalizeUpdateUrl(savedServer);
  return new URL("/downloads/windows/", server).toString();
}

function feedFromDownloadUrl(value) {
  if (!value) return null;
  const downloadUrl = normalizeUpdateUrl(value);
  if (downloadUrl.pathname.startsWith("/downloads/windows/")) {
    return new URL("./", downloadUrl).toString();
  }
  if (downloadUrl.pathname.startsWith("/downloads/")) {
    return new URL("/downloads/windows/", downloadUrl).toString();
  }
  return new URL("./", downloadUrl).toString();
}

function normalizeFeedUrl(value) {
  const url = normalizeUpdateUrl(value);
  if (!url.pathname.endsWith("/")) url.pathname = `${url.pathname}/`;
  return url.toString();
}

function normalizeUpdateUrl(value) {
  const url = new URL(String(value ?? ""));
  if (url.protocol !== "https:" && !isLocalServer(url)) {
    throw new Error("O servidor de atualizacoes tem de usar HTTPS.");
  }
  return url;
}

function compareVersions(left, right) {
  const a = String(left).split(".").map(Number);
  const b = String(right).split(".").map(Number);
  for (let index = 0; index < 3; index += 1) {
    const difference = (a[index] || 0) - (b[index] || 0);
    if (difference !== 0) return difference;
  }
  return 0;
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

function powerShellString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

async function relaunchElevated() {
  if (process.platform !== "win32") throw new Error("O modo administrador esta disponivel apenas no Windows.");
  if (!app.isPackaged) throw new Error("Instala o Orion Optimizer para ativares o modo administrador.");

  const profile = await invokeBridge("profile");
  if (profile?.isAdmin) return { relaunching: false, elevated: true };

  // O bloqueio de instancia tem de ser libertado antes de abrir a copia
  // elevada; de outro modo o Electron fecha a nova instancia como duplicada.
  app.releaseSingleInstanceLock();
  try {
    const command = [
      "$ErrorActionPreference = 'Stop'",
      `Start-Process -FilePath ${powerShellString(process.execPath)} -Verb RunAs -ErrorAction Stop`,
    ].join("; ");
    await runProcess("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", command]);
  } catch (error) {
    app.requestSingleInstanceLock();
    throw error;
  }

  setTimeout(() => app.quit(), 350);
  return { relaunching: true, elevated: false };
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

async function recordActivity(action, detail) {
  await api("/api/activity", {
    method: "POST",
    body: JSON.stringify({ action, detail: String(detail ?? "").slice(0, 120) }),
  }).catch((error) => {
    console.warn(`[orion] activity event failed (${action}):`, error.message);
  });
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
  ipcMain.handle("app:version", () => app.getVersion());
  ipcMain.handle("app:elevate", relaunchElevated);
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
        client_version: app.getVersion(),
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
    const result = await invokeBridge("preview", { tweak: trusted });
    await recordActivity("optimizer_previewed", trusted.id);
    return result;
  });
  ipcMain.handle("tweak:apply", async (_event, tweak) => {
    // Revalidar em cada execucao impede que um catalogo ja aberto continue a
    // funcionar depois da licenca expirar ou de a conta ser suspensa.
    const trusted = await authorizedTweak(tweak?.id, true);
    const result = await invokeBridge("apply", { tweak: trusted }, Number(trusted.layer) >= 1);
    await recordActivity("optimizer_applied", trusted.id);
    return result;
  });
  ipcMain.handle("history:list", async () => {
    const result = await invokeBridge("sessions");
    const items = result?.items?.value ?? result?.items;
    return Array.isArray(items) ? items : items ? [items] : [];
  });
  ipcMain.handle("history:rollback", async (_event, session) => {
    const elevated = Array.isArray(session?.entries) && session.entries.some((entry) => entry.hive === "HKLM");
    const result = await invokeBridge("rollback", { session }, elevated);
    await recordActivity("optimizer_rolled_back", session?.sessionId);
    return result;
  });
  ipcMain.handle("games:list", async () => {
    if (!apiToken) throw new Error("Inicia sessao primeiro.");
    const result = await invokeBridge("games");
    await recordActivity("optimizer_games_scanned", "desktop");
    return result;
  });
  ipcMain.handle("performance:snapshot", async () => {
    if (!apiToken) throw new Error("Inicia sessao primeiro.");
    return invokeBridge("performance");
  });
  ipcMain.handle("display:list", async () => {
    if (!apiToken) throw new Error("Inicia sessao primeiro.");
    return invokeBridge("displays");
  });
  ipcMain.handle("internal:overview", async () => {
    if (!account || !["staff", "developer", "owner"].includes(account.role)) {
      throw new Error("Esta area esta disponivel apenas para a equipa Orion.");
    }
    return api("/api/internal/overview");
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
    const userDetail = /^\/panel\/admin\/users\/\d+$/.test(safePath);
    if (!allowed?.has(safePath) && !(account.role === "owner" && userDetail)) {
      throw new Error("Este atalho nao esta disponivel para o teu cargo.");
    }
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
  void handleProtocolArgs(process.argv);
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
