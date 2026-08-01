import fs from "node:fs/promises";
import path from "node:path";

const cdpBase = process.argv[2] ?? "http://127.0.0.1:9336";
const sessionToken = process.argv[3];
if (!sessionToken) throw new Error("Falta o token de sessao.");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const targets = await fetch(`${cdpBase}/json/list`).then((response) => response.json());
const page = targets.find((target) => target.type === "page");
if (!page) throw new Error("Separador nao encontrado.");
const socket = new WebSocket(page.webSocketDebuggerUrl);
const pending = new Map();
let nextId = 1;
socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (!message.id || !pending.has(message.id)) return;
  const request = pending.get(message.id);
  pending.delete(message.id);
  message.error ? request.reject(new Error(message.error.message)) : request.resolve(message.result);
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
async function screenshot(name) {
  const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  const output = path.resolve("tests", "screenshots", name);
  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.writeFile(output, Buffer.from(shot.data, "base64"));
}
async function evaluate(expression) {
  const result = await send("Runtime.evaluate", { expression, returnByValue: true });
  return result.result.value;
}

await send("Page.enable");
await send("Runtime.enable");
await send("Network.enable");
await send("Network.setCookie", {
  name: "orion_session",
  value: sessionToken,
  url: "http://127.0.0.1:3400",
  httpOnly: true,
  sameSite: "Lax",
});
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await send("Page.navigate", { url: "http://127.0.0.1:3400/panel/dashboard" });
await sleep(2500);
await evaluate("window.scrollTo(0, 0)");
await sleep(250);
const updater = await evaluate(`JSON.stringify({
  update: document.body.textContent.includes('Atualizar Optimizer'),
  installed: document.body.textContent.includes('Instalada 0.9.0'),
  available: document.body.textContent.includes('disponivel 1.0.0'),
  download: document.body.textContent.includes('Descarregar instalador'),
  overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
})`);
await screenshot("optimizer-update-dashboard.png");

await send("Page.navigate", { url: "http://127.0.0.1:3400/panel/admin/plans" });
await sleep(2500);
await evaluate(`(() => {
  const card = [...document.querySelectorAll('article')].find((item) =>
    [...item.querySelectorAll('p')].some((text) => text.textContent.trim() === 'pro')
  );
  card?.querySelector('button[title="Editar plano"]')?.click();
})()`);
await sleep(600);
const desktop = await evaluate(`(() => {
  const form = document.querySelector('form [name="features"]')?.closest('form');
  const modal = form?.parentElement;
  const nav = form?.querySelector('nav');
  const rect = modal?.getBoundingClientRect();
  return JSON.stringify({
    modal: Boolean(modal),
    withinViewport: Boolean(rect && rect.top >= 0 && rect.bottom <= innerHeight),
    verticalScroll: Boolean(form && form.scrollHeight > form.clientHeight),
    horizontalNav: Boolean(nav && nav.scrollWidth >= nav.clientWidth),
    sections: ['Conteudo', 'Preco e acesso', 'Campanha', 'Automacao'].every((text) => nav?.textContent.includes(text)),
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  });
})()`);
await screenshot("plan-editor-scroll-desktop.png");

await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: false });
await sleep(500);
const mobile = await evaluate(`(() => {
  const form = document.querySelector('form [name="features"]')?.closest('form');
  const nav = form?.querySelector('nav');
  const modal = form?.parentElement;
  const rect = modal?.getBoundingClientRect();
  return JSON.stringify({
    withinViewport: Boolean(rect && rect.top >= 0 && rect.bottom <= innerHeight),
    verticalScroll: Boolean(form && form.scrollHeight > form.clientHeight),
    navCanScroll: Boolean(nav && nav.scrollWidth > nav.clientWidth),
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  });
})()`);
await screenshot("plan-editor-scroll-mobile.png");
console.log(`updater=${updater}`);
console.log(`desktop=${desktop}`);
console.log(`mobile=${mobile}`);
socket.close();
