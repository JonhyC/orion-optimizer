import { createServer } from "node:http";
import next from "next";

const production = process.argv.includes("--production");
const hostname = "0.0.0.0";
const port = Number(process.env.PORT ?? 3400);
process.env.ORION_NEXT_DIST_DIR = production ? ".next" : ".next-dev";

// Manter o cache de desenvolvimento separado impede que `next build`
// substitua CSS e manifests enquanto o servidor local esta aberto.
const app = next({
  dev: !production,
  hostname,
  port,
});
const handle = app.getRequestHandler();

await app.prepare();

const server = createServer((req, res) => handle(req, res));
server.listen(port, hostname, () => {
  console.log(`Orion ready on http://localhost:${port}`);
});

async function expirePlans() {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[orion] CRON_SECRET em falta; expiracoes periodicas desativadas");
    return;
  }

  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/cron/expire-plans`, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}` },
    });
    if (!response.ok) console.error(`[orion] cron de expiracoes respondeu ${response.status}`);
  } catch (error) {
    console.error("[orion] cron de expiracoes falhou:", error);
  }
}

const expiryTimer = setInterval(expirePlans, 60_000);
expiryTimer.unref();
setTimeout(expirePlans, 3_000).unref();

function shutdown() {
  clearInterval(expiryTimer);
  server.close(() => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
