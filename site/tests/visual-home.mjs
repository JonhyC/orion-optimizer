import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const cdpBase = process.argv[2] ?? "http://127.0.0.1:9334";
const appUrl = process.argv[3] ?? "http://127.0.0.1:3400";
const outputPath = process.argv[4] ?? path.join(os.tmpdir(), "orion-home-smoke.png");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const targets = await fetch(`${cdpBase}/json/list`).then((response) => response.json());
const page = targets.find((target) => target.type === "page");
if (!page) throw new Error("Nao foi encontrado um separador para o teste visual.");

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

await send("Page.enable");
await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", {
  width: 1440,
  height: 1000,
  deviceScaleFactor: 1,
  mobile: false,
});
await send("Page.navigate", { url: appUrl });
await sleep(5500);

const result = await send("Runtime.evaluate", {
  expression: `JSON.stringify({
    title: document.querySelector('h1')?.textContent?.replace(/\\s+/g, ' ').trim(),
    loaderVisible: Boolean(document.querySelector('[class*="z-[10000]"]')),
    background: getComputedStyle(document.body).backgroundColor,
    cssLoaded: parseFloat(getComputedStyle(document.querySelector('h1')).fontSize) >= 34,
    horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
  })`,
  returnByValue: true,
});

const state = JSON.parse(result.result.value);
if (!state.title || state.loaderVisible || !state.cssLoaded || state.horizontalOverflow) {
  throw new Error(`Smoke visual falhou: ${JSON.stringify(state)}`);
}

const screenshot = await send("Page.captureScreenshot", {
  format: "png",
  captureBeyondViewport: false,
});
await fs.writeFile(outputPath, Buffer.from(screenshot.data, "base64"));
console.log(JSON.stringify({ ...state, screenshot: outputPath }));
socket.close();
