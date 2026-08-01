import fs from "node:fs/promises";
import path from "node:path";

const cdpBase = process.argv[2] ?? "http://127.0.0.1:9334";
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
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });

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
const formState = await send("Runtime.evaluate", {
  expression: `(() => {
    const setValue = (name, value) => {
      const input = document.querySelector('[name="' + name + '"]');
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      setter.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true }));
    };
    const setChecked = (name, checked) => {
      const input = document.querySelector('[name="' + name + '"]');
      if (input.checked !== checked) input.click();
    };
    setValue('price', '24.99');
    setValue('badgeText', 'Escolha da Comunidade');
    setValue('compareAtPrice', '39.99');
    setValue('promoText', 'Semana Orion - poupa 15 EUR');
    setChecked('badgeActive', true);
    setChecked('discountActive', true);
    document.querySelector('[name="badgeText"]').scrollIntoView({ block: 'center' });
    return JSON.stringify({ modal: Boolean(document.querySelector('[name="badgeText"]')), badge: document.querySelector('[name="badgeText"]')?.value });
  })()`,
  returnByValue: true,
});
await sleep(500);
await screenshot("plan-marketing-admin.png");
await send("Runtime.evaluate", { expression: `document.querySelector('[name="badgeText"]')?.closest('form')?.requestSubmit()` });
await sleep(2200);

await send("Page.navigate", { url: "http://127.0.0.1:3400/#packages" });
await sleep(2600);
await send("Runtime.evaluate", { expression: `[...document.querySelectorAll('#packages h3')].find((title) => title.textContent.trim() === 'Pro')?.closest('.glow-border')?.scrollIntoView({ block: 'start' })` });
await sleep(700);
const publicState = await send("Runtime.evaluate", {
  expression: `(() => {
    const section = document.querySelector('#packages');
    return JSON.stringify({
      badge: section?.textContent.includes('Escolha da Comunidade'),
      oldPrice: section?.textContent.includes('EUR 39.99'),
      newPrice: section?.textContent.includes('24.99'),
      announcement: section?.textContent.includes('Semana Orion - poupa 15 EUR'),
      horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    });
  })()`,
  returnByValue: true,
});
await screenshot("plan-marketing-public-desktop.png");

await send("Emulation.setScrollbarsHidden", { hidden: true });
await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: false });
await send("Page.navigate", { url: "http://127.0.0.1:3400/#packages" });
await sleep(2200);
await send("Runtime.evaluate", { expression: `[...document.querySelectorAll('#packages h3')].find((title) => title.textContent.trim() === 'Pro')?.closest('.glow-border')?.scrollIntoView({ block: 'start' })` });
await sleep(500);
const mobileState = await send("Runtime.evaluate", {
  expression: `(() => {
    const root = document.documentElement;
    const offenders = [...document.querySelectorAll('body *')]
      .map((element) => ({ element, rect: element.getBoundingClientRect() }))
      .filter(({ rect }) => rect.right > root.clientWidth + 1)
      .sort((a, b) => b.rect.right - a.rect.right)
      .slice(0, 8)
      .map(({ element, rect }) => ({ tag: element.tagName, className: String(element.className).slice(0, 100), left: Math.round(rect.left), right: Math.round(rect.right) }));
    return JSON.stringify({ clientWidth: root.clientWidth, scrollWidth: root.scrollWidth, innerWidth, horizontalOverflow: root.scrollWidth > root.clientWidth, badge: document.querySelector('#packages')?.textContent.includes('Escolha da Comunidade'), offenders });
  })()`,
  returnByValue: true,
});
await screenshot("plan-marketing-public-mobile.png");

console.log(`admin=${formState.result.value}`);
console.log(`public=${publicState.result.value}`);
console.log(`mobile=${mobileState.result.value}`);
socket.close();
