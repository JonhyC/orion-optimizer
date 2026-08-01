import fs from "node:fs/promises";
import path from "node:path";

const cdpBase = process.argv[2] ?? "http://127.0.0.1:9335";
const sessionToken = process.argv[3];
if (!sessionToken) throw new Error("Falta o token de sessao de teste.");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const targets = await fetch(`${cdpBase}/json/list`).then((response) => response.json());
const page = targets.find((target) => target.type === "page");
if (!page) throw new Error("Separador de teste nao encontrado.");

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
  const result = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  const output = path.resolve("tests", "screenshots", name);
  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.writeFile(output, Buffer.from(result.data, "base64"));
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
await send("Emulation.setDeviceMetricsOverride", {
  width: 1440,
  height: 1000,
  deviceScaleFactor: 1,
  mobile: false,
});

await send("Page.navigate", { url: "http://127.0.0.1:3400/panel/admin/plans" });
await sleep(2600);
await send("Runtime.evaluate", {
  expression: `(() => {
    const card = [...document.querySelectorAll('article')].find((item) =>
      [...item.querySelectorAll('p')].some((text) => text.textContent.trim() === 'pro')
    );
    card?.querySelector('button[title="Editar plano"]')?.click();
  })()`,
});
await sleep(700);
const editorState = await send("Runtime.evaluate", {
  expression: `(() => {
    const setValue = (name, value) => {
      const input = document.querySelector('[name="' + name + '"]');
      if (!input) throw new Error('Campo em falta: ' + name);
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    };
    setValue('description', 'Teste de descricao totalmente personalizavel.');
    setValue('features', 'Primeira informacao personalizada\\nSegunda informacao personalizada\\nTerceira informacao personalizada');
    setValue('ctaText', 'Escolher Pro');
    const previewButton = [...document.querySelectorAll('button')].find((button) => button.textContent.trim() === 'Visualizar');
    previewButton?.click();
    return JSON.stringify({
      sections: ['Conteudo publico', 'Preco e acesso', 'Destaques e campanha', 'Automacao e publicacao'].every((text) => document.body.textContent.includes(text)),
      previewButton: Boolean(previewButton),
    });
  })()`,
  returnByValue: true,
});
await sleep(700);
const desktopState = await send("Runtime.evaluate", {
  expression: `JSON.stringify({
    dialog: Boolean(document.querySelector('[aria-label="Pre-visualizacao do plano"]')),
    description: document.body.textContent.includes('Teste de descricao totalmente personalizavel.'),
    features: document.body.textContent.includes('Primeira informacao personalizada') && document.body.textContent.includes('Terceira informacao personalizada'),
    cta: document.body.textContent.includes('Escolher Pro'),
    horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  })`,
  returnByValue: true,
});
await screenshot("plan-content-preview-desktop.png");

await send("Emulation.setDeviceMetricsOverride", {
  width: 390,
  height: 844,
  deviceScaleFactor: 1,
  mobile: false,
});
await sleep(500);
const mobileState = await send("Runtime.evaluate", {
  expression: `JSON.stringify({
    width: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    dialog: Boolean(document.querySelector('[aria-label="Pre-visualizacao do plano"]')),
    cta: document.body.textContent.includes('Escolher Pro'),
  })`,
  returnByValue: true,
});
await screenshot("plan-content-preview-mobile.png");

console.log(`editor=${editorState.result.value}`);
console.log(`desktop=${desktopState.result.value}`);
console.log(`mobile=${mobileState.result.value}`);
socket.close();
