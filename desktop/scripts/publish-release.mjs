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
const downloadsDir = path.join(site, "public", "downloads");
const windowsDir = path.join(site, "public", "downloads", "windows");
const localPublish = process.argv.includes("--local");
const repository = process.env.ORION_GITHUB_REPOSITORY || "JonhyC/orion-optimizer";
const tag = `v${pkg.version}`;
const encodedSetupName = setupName.split(" ").map(encodeURIComponent).join("%20");
const downloadUrl = `https://github.com/${repository}/releases/download/${tag}/${encodedSetupName}`;

for (const file of [sourceSetup, sourceBlockmap, sourceManifest]) {
  await fs.access(file);
}

if (!localPublish) runGh(["auth", "status", "--hostname", "github.com"]);

const updateInfo = yaml.load(await fs.readFile(sourceManifest, "utf8"));
if (!updateInfo || typeof updateInfo !== "object" || !Array.isArray(updateInfo.files)) {
  throw new Error("O latest.yml gerado pelo Electron Builder e invalido.");
}
const manifestSetupPath = localPublish ? setupName : downloadUrl;
for (const file of updateInfo.files) file.url = manifestSetupPath;
updateInfo.path = manifestSetupPath;
await fs.writeFile(sourceManifest, yaml.dump(updateInfo, { lineWidth: -1 }), "utf8");

if (!localPublish) {
  if (!releaseExists()) {
    runGh(["release", "create", tag, "--repo", repository, "--target", "main", "--title", `Orion Optimizer ${pkg.version}`, "--notes", `Release automatica do Orion Optimizer ${pkg.version}.`]);
  }
  runGh(["release", "upload", tag, sourceSetup, sourceBlockmap, sourceManifest, "--repo", repository, "--clobber"]);
}

await fs.mkdir(windowsDir, { recursive: true });
await fs.copyFile(sourceManifest, path.join(windowsDir, "latest.yml"));
if (localPublish) {
  await fs.copyFile(sourceSetup, path.join(windowsDir, setupName));
  await fs.copyFile(sourceBlockmap, path.join(windowsDir, `${setupName}.blockmap`));
  await fs.copyFile(sourceSetup, path.join(downloadsDir, "Orion-Optimizer-Setup.exe"));
}

const setupBytes = await fs.readFile(sourceSetup);
const sha256 = crypto.createHash("sha256").update(setupBytes).digest("hex");

// Notas da versao: uma linha por alteracao, vindas de NOTAS.md ao lado do
// package.json. Escrever isto a mao no JSON depois de publicar era o tipo
// de passo que se esquece - e uma actualizacao sem notas obriga quem a
// recebe a confiar as cegas.
const notes = await readNotes();

// minSupported nao e gerado: obrigar toda a gente a actualizar e uma
// decisao humana, tomada quando uma versao tem um defeito que nao pode
// ficar em circulacao. Preserva-se o que ja la estiver.
const anterior = await readExistingManifest();

const release = {
  version: pkg.version,
  downloadPath: localPublish ? "/downloads/Orion-Optimizer-Setup.exe" : downloadUrl,
  sha256,
  sizeBytes: setupBytes.byteLength,
  releasedAt: Math.floor(Date.now() / 1000),
  ...(notes.length ? { notes } : {}),
  ...(anterior?.minSupported ? { minSupported: anterior.minSupported } : {}),
};
await fs.writeFile(
  path.join(site, "config", "optimizer-release.json"),
  `${JSON.stringify(release, null, 2)}\n`,
  "utf8",
);

console.log(
  localPublish
    ? `Orion Optimizer ${pkg.version} publicado no site local.`
    : `Orion Optimizer ${pkg.version} publicado no GitHub e no site.`,
);

/**
 * Le NOTAS.md. SO linhas de lista ("- ..." ou "* ...").
 *
 * Exigir o marcador nao e formalidade: sem isso, o texto que explica como
 * usar o ficheiro entrava no manifesto como se fosse nota de versao - foi
 * exactamente o que aconteceu a primeira vez.
 */
async function readNotes() {
  try {
    const bruto = await fs.readFile(path.join(root, "NOTAS.md"), "utf8");
    return bruto
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => /^[-*]\s+\S/.test(l))
      .map((l) => l.replace(/^[-*]\s+/, ""))
      .slice(0, 12);
  } catch {
    return [];
  }
}

async function readExistingManifest() {
  try {
    return JSON.parse(await fs.readFile(path.join(site, "config", "optimizer-release.json"), "utf8"));
  } catch {
    return null;
  }
}

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
