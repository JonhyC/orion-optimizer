import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as yaml from "js-yaml";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const site = path.resolve(root, "..", "site");
const pkg = JSON.parse(await fs.readFile(path.join(root, "package.json"), "utf8"));
const productName = pkg.productName || pkg.build?.productName || "Orion Optimizer 2.0";
const setupName = `${productName} Setup ${pkg.version}.exe`;
const sourceSetup = path.join(root, "release", setupName);
const sourceBlockmap = `${sourceSetup}.blockmap`;
const sourceManifest = path.join(root, "release", "latest.yml");
const downloadsDir = path.join(site, "public", "downloads");
const windowsDir = path.join(site, "public", "downloads", "windows");
const localPublish = process.argv.includes("--local");
const repository = process.env.ORION_GITHUB_REPOSITORY || "JonhyC/orion-optimizer";
const tag = `v${pkg.version}`;
let setupSize = 0;

for (const [label, file] of [["instalador", sourceSetup], ["blockmap", sourceBlockmap], ["manifesto", sourceManifest]]) {
  try {
    await fs.access(file);
  } catch {
    throw new Error(`A release foi bloqueada: ${label} nao encontrado. O Microsoft Defender pode te-lo colocado em quarentena.`);
  }
}
setupSize = (await fs.stat(sourceSetup)).size;

if (!localPublish) {
  requireValidWindowsSignature(sourceSetup);
  runGh(["auth", "status", "--hostname", "github.com"]);
}

const updateInfo = yaml.load(await fs.readFile(sourceManifest, "utf8"));
if (!updateInfo || typeof updateInfo !== "object" || !Array.isArray(updateInfo.files)) {
  throw new Error("O latest.yml gerado pelo Electron Builder e invalido.");
}
let manifestSetupPath = setupName;

if (!localPublish) {
  if (!releaseExists()) {
    runGh(["release", "create", tag, "--repo", repository, "--target", "main", "--title", `${productName} ${pkg.version}`, "--notes", `Release automatica do ${productName} ${pkg.version}.`]);
  }
  runGh(["release", "upload", tag, sourceSetup, sourceBlockmap, "--repo", repository, "--clobber"]);
  manifestSetupPath = publishedSetupUrl();
}

for (const file of updateInfo.files) file.url = manifestSetupPath;
updateInfo.path = manifestSetupPath;
await fs.writeFile(sourceManifest, yaml.dump(updateInfo, { lineWidth: -1 }), "utf8");

if (!localPublish) {
  runGh(["release", "upload", tag, sourceManifest, "--repo", repository, "--clobber"]);
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
  downloadPath: localPublish ? "/downloads/Orion-Optimizer-Setup.exe" : manifestSetupPath,
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
    ? `${productName} ${pkg.version} publicado no site local.`
    : `${productName} ${pkg.version} publicado no GitHub e no site.`,
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

function requireValidWindowsSignature(file) {
  const escapedPath = file.replaceAll("'", "''");
  const command = [
    `$signature = Get-AuthenticodeSignature -FilePath '${escapedPath}' -ErrorAction Stop`,
    "if ($signature.Status -ne 'Valid') { Write-Error ('Assinatura Authenticode invalida: ' + $signature.Status); exit 1 }",
  ].join("; ");
  const result = spawnSync("powershell.exe", ["-NoProfile", "-Command", command], {
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.error || result.status !== 0) {
    const detail = result.stderr?.trim() || result.stdout?.trim() || "certificado de assinatura em falta";
    throw new Error(`A release foi bloqueada: o instalador nao tem uma assinatura Authenticode valida (${detail}).`);
  }
}

function publishedSetupUrl() {
  const result = spawnSync("gh", ["release", "view", tag, "--repo", repository, "--json", "assets"], {
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.error || result.status !== 0) {
    throw new Error("Nao foi possivel ler os assets publicados na GitHub Release.");
  }
  const release = JSON.parse(result.stdout);
  const asset = release.assets.find((item) => item.name.endsWith(".exe") && item.size === setupSize);
  if (!asset?.url) throw new Error("O instalador publicado nao foi encontrado na GitHub Release.");
  return asset.url;
}

function runGh(args) {
  const result = spawnSync("gh", args, { stdio: "inherit", windowsHide: true });
  if (result.error) throw new Error(`Nao foi possivel executar o GitHub CLI: ${result.error.message}`);
  if (result.status !== 0) {
    throw new Error("A publicacao da GitHub Release falhou. O manifesto do site nao foi alterado.");
  }
}
