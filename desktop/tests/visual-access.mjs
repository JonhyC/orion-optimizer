import fs from "node:fs/promises";
import path from "node:path";

const cdpBase = process.argv[2] ?? "http://127.0.0.1:9333";
const appUrl = process.argv[3] ?? "http://127.0.0.1:5174";
const outputDir = path.resolve("tests", "screenshots");
const packageVersion = JSON.parse(await fs.readFile(path.resolve("package.json"), "utf8")).version;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const targets = await fetch(`${cdpBase}/json/list`).then((response) => response.json());
const page = targets.find((target) => target.type === "page");
if (!page) throw new Error("Nao foi encontrado um separador no Edge de teste.");

const socket = new WebSocket(page.webSocketDebuggerUrl);
const pending = new Map();
let nextId = 1;

socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (!message.id) return;
  const request = pending.get(message.id);
  if (!request) return;
  pending.delete(message.id);
  if (message.error) request.reject(new Error(message.error.message));
  else request.resolve(message.result);
});

await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});

function send(method, params = {}) {
  const id = nextId++;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

const mockSource = `
  (() => {
    localStorage.clear();
    const allTweaks = [
      ["ux.visual-effects", "Efeitos visuais para desempenho", 0],
      ["ux.menu-delay", "Remover atraso dos menus", 0],
      ["privacy.advertising-id", "Desativar ID de publicidade", 0],
      ["privacy.content-delivery", "Desativar sugestoes e instalacoes silenciosas", 0],
      ["game.dvr-background", "Desativar gravacao em background", 0],
      ["game.gamebar-startup", "Desativar painel da Game Bar", 0],
      ["net.throttling-index", "Desativar Network Throttling", 1],
      ["mmcss.games-priority", "Prioridade MMCSS para jogos", 1],
      ["gpu.hags", "GPU Hardware-Accelerated Scheduling", 1],
      ["power.high-performance-bias", "Reduzir parking de nucleos de CPU", 1],
    ].map(([id, name, layer]) => ({ id, name, layer, description: "Ajuste Orion verificado e reversivel.", impact: "medio", risk: "baixo", requiresReboot: layer === 1, actions: [] }));
    const fixture = new URLSearchParams(location.search).get("fixture") || "basic";
    const counts = { basic: 6, pro: 8, ultimate: 10, special: 10, staff: 10, developer: 10, owner: 10 };
    const internalRoles = new Set(["staff", "developer", "owner"]);
    const role = internalRoles.has(fixture) ? fixture : "client";
    const tier = internalRoles.has(fixture) ? "orion" : fixture;
    const tweaks = allTweaks.slice(0, counts[fixture] || 6);
    const account = {
      username: "orion.visual",
      display_name: internalRoles.has(fixture) ? "Orion " + fixture[0].toUpperCase() + fixture.slice(1) : "Membro " + fixture[0].toUpperCase() + fixture.slice(1),
      discord_avatar_url: "https://cdn.discordapp.com/embed/avatars/0.png",
      role,
      tier,
      discord_verified: true,
      expires_at: fixture === "special" || internalRoles.has(fixture) ? null : Math.floor(Date.now() / 1000) + 86400 * 30,
      support_expires_at: null,
      support_lifetime: fixture === "special" || internalRoles.has(fixture),
    };
    window.orion = {
      appVersion: async () => "${packageVersion}",
      getSettings: async () => ({ server: "http://localhost:3400", username: "orion.visual" }),
      saveSettings: async () => undefined,
      profile: async () => ({ isAdmin: true, chassis: "desktop", gpuVendor: "NVIDIA", gpuVendors: ["NVIDIA"], gpuTypes: ["dedicated"], gpuNames: ["NVIDIA GeForce RTX"], ramGB: 32, hwid: "visual", executionMode: "Mock" }),
      login: async () => ({ user: account, server: "http://localhost:3400" }),
      logout: async () => true,
      catalog: async () => ({ tweaks, eligibility: Object.fromEntries(tweaks.map((t) => [t.id, { eligible: true, reason: "" }])), account }),
      preview: async () => [], apply: async () => ({ sessionId: "visual", changes: [] }),
      sessions: async () => [], rollback: async () => [], openPortal: async () => true,
      internalOverview: async () => ({
        generatedAt: Math.floor(Date.now() / 1000), onlineWindowSeconds: 300,
        metrics: { users: 48, activeLicenses: 31, onlineSite: 7, onlineOptimizer: 12, failedLogins24h: 2, optimizerActions24h: 86, catalogRequests24h: 40, revenue30Cents: fixture === "owner" ? 184920 : null },
        people: [
          { id: 1, username: "alpha", displayName: "Alpha", avatarUrl: "https://cdn.discordapp.com/embed/avatars/1.png", role: "client", tier: "pro", status: "active", clientVersion: "1.0.1", clientSeenAt: Math.floor(Date.now()/1000)-20, siteSeenAt: Math.floor(Date.now()/1000)-50, optimizerSeenAt: Math.floor(Date.now()/1000)-20, siteOnline: true, optimizerOnline: true, lastActivityAt: Math.floor(Date.now()/1000)-20 },
          { id: 2, username: "beta", displayName: "Beta", avatarUrl: null, role: "client", tier: "basic", status: "active", clientVersion: "1.0.0", clientSeenAt: Math.floor(Date.now()/1000)-500, siteSeenAt: null, optimizerSeenAt: Math.floor(Date.now()/1000)-500, siteOnline: false, optimizerOnline: false, lastActivityAt: Math.floor(Date.now()/1000)-500 },
          { id: 3, username: "staff.one", displayName: "Staff One", avatarUrl: null, role: "staff", tier: null, status: "active", clientVersion: "1.0.1", clientSeenAt: Math.floor(Date.now()/1000)-70, siteSeenAt: Math.floor(Date.now()/1000)-70, optimizerSeenAt: null, siteOnline: true, optimizerOnline: false, lastActivityAt: Math.floor(Date.now()/1000)-70 },
        ],
        activity: [
          { id: 1, action: "optimizer_applied", detail: "gpu.hags", createdAt: Math.floor(Date.now()/1000)-20, userId: 1, username: "Alpha" },
          { id: 2, action: "panel_login_ok", detail: null, createdAt: Math.floor(Date.now()/1000)-70, userId: 3, username: "Staff One" },
          { id: 3, action: "catalog_served", detail: "8 tweaks", createdAt: Math.floor(Date.now()/1000)-500, userId: 2, username: "Beta" },
        ],
        usage: [{ action: "optimizer_applied", count: 52 }, { action: "catalog_served", count: 40 }],
        versions: [{ version: "1.0.1", count: 18 }, { version: "1.0.0", count: 4 }],
      }),
      minimize() {}, maximize() {}, close() {},
    };
  })();
`;

await fs.mkdir(outputDir, { recursive: true });
await send("Page.enable");
await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", {
  width: 1280,
  height: 800,
  deviceScaleFactor: 1,
  mobile: false,
});
await send("Page.addScriptToEvaluateOnNewDocument", { source: mockSource });

for (const fixture of ["basic", "pro", "ultimate", "special", "staff", "developer", "owner"]) {
  await send("Page.navigate", { url: `${appUrl}/?fixture=${fixture}` });
  await sleep(1600);
  if (fixture === "basic") {
    const loginDark = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    await fs.writeFile(path.join(outputDir, "login-dark.png"), Buffer.from(loginDark.data, "base64"));
    await send("Runtime.evaluate", { expression: `document.querySelector('.titlebar-theme')?.click()` });
    await sleep(350);
    const loginLight = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    await fs.writeFile(path.join(outputDir, "login-light.png"), Buffer.from(loginLight.data, "base64"));
    await send("Runtime.evaluate", { expression: `document.querySelector('.titlebar-theme')?.click()` });
    await sleep(250);
  }
  await send("Runtime.evaluate", {
    expression: `(() => {
      const inputs = document.querySelectorAll('input');
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      set.call(inputs[0], 'orion.visual'); inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
      set.call(inputs[1], 'visual-password'); inputs[1].dispatchEvent(new Event('input', { bubbles: true }));
      document.querySelector('form').requestSubmit();
    })()`,
  });
  await sleep(1800);
  await send("Runtime.evaluate", { expression: `[...document.querySelectorAll('button')].find((button) => button.textContent.includes('Definições'))?.click()` });
  await sleep(500);
  await send("Runtime.evaluate", { expression: `window.__orionSettingsTest = { profile: Boolean(document.querySelector('.settings-profile')), panels: document.querySelectorAll('.settings-panel').length }` });
  if (fixture === "owner") {
    await send("Runtime.evaluate", { expression: `[...document.querySelectorAll('.theme-options button')].find((button) => button.textContent.includes('Claro'))?.click()` });
    await sleep(450);
    const settingsScreenshot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    await fs.writeFile(path.join(outputDir, "owner-settings-light.png"), Buffer.from(settingsScreenshot.data, "base64"));
    await send("Runtime.evaluate", { expression: `window.__orionSettingsTest.light = document.documentElement.dataset.theme === 'light'; [...document.querySelectorAll('.theme-options button')].find((button) => button.textContent.includes('Escuro'))?.click()` });
    await sleep(350);
  }
  if (["staff", "developer", "owner"].includes(fixture)) {
    await send("Runtime.evaluate", { expression: `[...document.querySelectorAll('button')].find((button) => button.textContent.includes('Equipa'))?.click()` });
    await sleep(700);
    await send("Runtime.evaluate", {
      expression: `(async () => {
        let opened = 0;
        const count = document.querySelectorAll('.internal-tool').length;
        for (let index = 0; index < count; index += 1) {
          document.querySelectorAll('.internal-tool')[index].click();
          await new Promise((resolve) => setTimeout(resolve, 180));
          if (document.querySelector('.internal-tool-modal')) opened += 1;
          document.querySelector('.internal-tool-modal .modal-close')?.click();
          await new Promise((resolve) => setTimeout(resolve, 180));
        }
        await new Promise((resolve) => setTimeout(resolve, 450));
        document.querySelector('.presence-row')?.click();
        await new Promise((resolve) => setTimeout(resolve, 300));
        window.__orionModalTest = { opened, person: Boolean(document.querySelector('.person-modal')) };
        document.querySelector('.person-modal .modal-close')?.click();
      })()`,
      awaitPromise: true,
    });
    await sleep(600);
    await send("Runtime.evaluate", { expression: `document.querySelectorAll('.internal-tool')[document.querySelectorAll('.internal-tool').length - 1]?.click()` });
    await sleep(450);
    const modalScreenshot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    await fs.writeFile(path.join(outputDir, `${fixture}-modal.png`), Buffer.from(modalScreenshot.data, "base64"));
    await send("Runtime.evaluate", { expression: `document.querySelector('.internal-tool-modal .modal-close')?.click()` });
    await sleep(300);
  } else {
    await send("Runtime.evaluate", { expression: `[...document.querySelectorAll('button')].find((button) => button.textContent.includes('Otimizações'))?.click()` });
    await sleep(400);
  }
  const state = await send("Runtime.evaluate", {
    expression: `JSON.stringify({ title: document.querySelector('.page-header h1')?.textContent, version: document.querySelector('.app-version')?.textContent, settingsProfile: window.__orionSettingsTest?.profile ?? false, settingsPanels: window.__orionSettingsTest?.panels ?? 0, lightTheme: window.__orionSettingsTest?.light ?? null, cards: document.querySelectorAll('.tweak-card').length, tools: document.querySelectorAll('.internal-tool').length, testedToolModals: window.__orionModalTest?.opened ?? 0, personModal: window.__orionModalTest?.person ?? false, capabilities: document.querySelectorAll('.capability-row').length, operationMetrics: document.querySelectorAll('.operation-metric').length, people: document.querySelectorAll('.presence-row').length, activity: document.querySelectorAll('.activity-entry').length, hasStandard: document.body.textContent.includes('Standard'), avatarLoaded: Boolean(document.querySelector('.avatar img')?.complete && document.querySelector('.avatar img')?.naturalWidth), horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth })`,
    returnByValue: true,
  });
  const screenshot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  await fs.writeFile(path.join(outputDir, `${fixture}.png`), Buffer.from(screenshot.data, "base64"));
  console.log(`${fixture}: ${state.result.value}`);
}

socket.close();
