import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const site = path.resolve(root, "..", "site");
const pkg = JSON.parse(await fs.readFile(path.join(root, "package.json"), "utf8"));
const setupName = `Orion Optimizer Setup ${pkg.version}.exe`;
const sourceSetup = path.join(root, "release", setupName);
const sourceBlockmap = `${sourceSetup}.blockmap`;
const sourceManifest = path.join(root, "release", "latest.yml");
const windowsDir = path.join(site, "public", "downloads", "windows");
const publicSetup = path.join(site, "public", "downloads", "Orion-Optimizer-Setup.exe");

for (const file of [sourceSetup, sourceBlockmap, sourceManifest]) {
  await fs.access(file);
}

await fs.mkdir(windowsDir, { recursive: true });
await Promise.all([
  fs.copyFile(sourceSetup, path.join(windowsDir, setupName)),
  fs.copyFile(sourceBlockmap, path.join(windowsDir, `${setupName}.blockmap`)),
  fs.copyFile(sourceManifest, path.join(windowsDir, "latest.yml")),
  fs.copyFile(sourceSetup, publicSetup),
]);

const sha256 = crypto
  .createHash("sha256")
  .update(await fs.readFile(sourceSetup))
  .digest("hex");
const release = {
  version: pkg.version,
  downloadPath: "/downloads/Orion-Optimizer-Setup.exe",
  sha256,
};
await fs.writeFile(
  path.join(site, "config", "optimizer-release.json"),
  `${JSON.stringify(release, null, 2)}\n`,
  "utf8",
);

console.log(`Orion Optimizer ${pkg.version} publicado no site.`);
