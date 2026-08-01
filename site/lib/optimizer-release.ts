import fs from "node:fs";
import path from "node:path";

export type OptimizerRelease = {
  version: string;
  downloadPath: string;
  sha256: string;
};

const RELEASE_PATH = path.join(process.cwd(), "config", "optimizer-release.json");

export function optimizerRelease(): OptimizerRelease {
  const value: unknown = JSON.parse(fs.readFileSync(RELEASE_PATH, "utf8"));
  if (!isRelease(value)) throw new Error("Manifesto da aplicacao Orion invalido.");
  return value;
}

function isRelease(value: unknown): value is OptimizerRelease {
  if (!value || typeof value !== "object") return false;
  const release = value as Record<string, unknown>;
  return (
    typeof release.version === "string" && /^\d+\.\d+\.\d+$/.test(release.version) &&
    typeof release.downloadPath === "string" && /^\/downloads\/[a-zA-Z0-9._-]+\.exe$/.test(release.downloadPath) &&
    typeof release.sha256 === "string" && /^[a-f0-9]{64}$/.test(release.sha256)
  );
}
