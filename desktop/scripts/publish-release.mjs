import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as yaml from "js-yaml";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const site = path.resolve(root, "..", "site");
const pkg = JSON.parse(await fs.readFile(path.join(root, "package.json"), "utf8"));
const setupName = `Orion Optimizer Setup ${pkg.version}.exe`;
const sourceSetup = path.join(root, "release", setupName);
const sourceBlockmap = `${sourceSetup}.blockmap`;
const sourceManifest = path.join(root, "release", "latest.yml");
const windowsDir = path.join(site, "public", "downloads", "windows");
const repository = process.env.ORION_GITHUB_REPOSITORY || "JonhyC/orion-optimizer";
const tag = `v${pkg.version}`;
const encodedSetupName = setupName.split(" ").map(encodeURIComponent).join("%20");
const downloadUrl = `https://github.com/${repository}/releases/download/${tag}/${encodedSetupName}`;

for (const file of [sourceSetup, sourceBlockmap, sourceManifest]) {
  await fs.access(file);
}

runGh(["auth", "status", "--hostname", "github.com"]);

const updateInfo = yaml.load(await fs.readFile(sourceManifest, "utf8"));
if (!updateInfo || typeof updateInfo !== "object" || !Array.isArray(updateInfo.files)) {
  throw new Error("O latest.yml gerado pelo Electron Builder e invalido.");
}
for (const file of updateInfo.files) file.url = downloadUrl;
updateInfo.path = downloadUrl;
await fs.writeFile(sourceManifest, yaml.dump(updateInfo, { lineWidth: -1 }), "utf8");

if (!releaseExists()) {
  runGh(["release", "create", tag, "--repo", repository, "--target", "main", "--title", `Orion Optimizer ${pkg.version}`, "--notes", `Release automatica do Orion Optimizer ${pkg.version}.`]);
}
runGh(["release", "upload", tag, sourceSetup, sourceBlockmap, sourceManifest, "--repo", repository, "--clobber"]);

await fs.mkdir(windowsDir, { recursive: true });
await fs.copyFile(sourceManifest, path.join(windowsDir, "latest.yml"));

const sha256 = crypto
  .createHash("sha256")
  .update(await fs.readFile(sourceSetup))
  .digest("hex");
const release = {
  version: pkg.version,
  downloadPath: downloadUrl,
  sha256,
};
await fs.writeFile(
  path.join(site, "config", "optimizer-release.json"),
  `${JSON.stringify(release, null, 2)}\n`,
  "utf8",
);

console.log(`Orion Optimizer ${pkg.version} publicado no site.`);

function releaseExists() {
  return spawnSync("gh", ["release", "view", tag, "--repo", repository], {
    stdio: "ignore",
    windowsHide: true,
  }).status === 0;
}

function runGh(args) {
  const result = spawnSync("gh", args, { stdio: "inherit", windowsHide: true });
  if (result.error) throw new Error(`Nao foi possivel executar o GitHub CLI: ${result.error.message}`);
  if (result.status !== 0) {
    throw new Error("A publicacao da GitHub Release falhou. O manifesto do site nao foi alterado.");
  }
}
